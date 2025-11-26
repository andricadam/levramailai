import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

import { NextResponse } from "next/server";
import { OramaClient } from "@/lib/orama";
import { QACacheClient } from "@/lib/qa-cache";
import { db } from "@/server/db";
import { auth } from "@clerk/nextjs/server";
import { getSubscriptionStatus } from "@/lib/stripe-actions";
import { FREE_CREDITS_PER_DAY, QA_CACHE_SIMILARITY_THRESHOLD, SMALL_MODEL, LARGE_MODEL } from "@/app/constants";
import { turndown } from "@/lib/turndown";
import { downloadAndProcessAttachments } from "@/lib/download-attachment";
import { MAX_FILE_SIZE } from "@/lib/file-processor";

// export const runtime = "edge";

if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is not set");
}

const openai = createOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
    try {
        const { userId } = await auth()
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const isSubscribed = await getSubscriptionStatus()
        const today = new Date().toDateString();
        
        if (!isSubscribed) {
            const chatbotInteraction = await db.chatbotInteraction.findUnique({
                where: {
                    day_userId: {
                        day: today,
                        userId
                    }
                }
            })
            if (!chatbotInteraction) {
                await db.chatbotInteraction.create({
                    data: {
                        day: today,
                        count: 0,
                        userId
                    }
                })
            } else if (chatbotInteraction.count >= FREE_CREDITS_PER_DAY) {
                return NextResponse.json({ error: "Limit reached" }, { status: 429 });
            }
        }
        let body;
        try {
            body = await req.json();
            console.log("Received request body:", JSON.stringify(body, null, 2));
        } catch (parseError) {
            console.error("Failed to parse request body:", parseError);
            return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
        }
        
        const { messages, accountId, emailContext, fileContext } = body;
        
        console.log("Extracted values - messages:", messages?.length, "accountId:", accountId, "emailContext:", emailContext, "fileContext:", fileContext);
        
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            console.error("Invalid messages:", messages);
            return NextResponse.json({ error: "Messages are required" }, { status: 400 });
        }
        
        if (!accountId || accountId.trim() === '') {
            console.error("Missing or empty accountId:", accountId);
            return NextResponse.json({ error: "accountId is required" }, { status: 400 });
        }

        const lastMessage = messages[messages.length - 1]
        
        // Extract text content from message parts (AI SDK format)
        const getMessageContent = (message: any): string => {
            if (message.content) return message.content;
            if (message.parts) {
                return message.parts
                    .filter((part: any) => part.type === 'text')
                    .map((part: any) => part.text)
                    .join('');
            }
            return '';
        };

        const lastMessageContent = getMessageContent(lastMessage);
        if (!lastMessageContent) {
            return NextResponse.json({ error: "Invalid message format" }, { status: 400 });
        }

        // ===== STAGE 1: Check Q&A Cache =====
        let cachedQA = null;
        try {
            const qaCache = new QACacheClient(accountId);
            await qaCache.initialize();
            cachedQA = await qaCache.searchSimilarQuery(lastMessageContent, QA_CACHE_SIMILARITY_THRESHOLD);
            
            if (cachedQA) {
                console.log("Found similar Q&A in cache, using small model");
                
                // Use small model (GPT-3.5-turbo) to adapt the cached response
                const result = await streamText({
                    model: openai(SMALL_MODEL),
                    messages: [
                        {
                            role: "system",
                            content: `You are an AI assistant. Adapt the following previous answer to better match the user's new question. Keep the core information but adjust the wording and details to be more relevant to the new query.

PREVIOUS QUESTION: ${cachedQA.document?.query || ''}
PREVIOUS ANSWER: ${cachedQA.document?.response || ''}
NEW USER QUESTION: ${lastMessageContent}

Guidelines:
- Keep the essential information from the previous answer
- Adjust wording to better match the new question
- Don't invent new information not in the previous answer
- Be concise and helpful
- If the new question is very different, acknowledge that and provide what you can from the previous answer`
                        },
                        {
                            role: "user",
                            content: lastMessageContent
                        }
                    ],
                    onFinish: async (result) => {
                        // Update subscription count for free users
                        if (!isSubscribed) {
                            try {
                                await db.chatbotInteraction.update({
                                    where: {
                                        day_userId: {
                                            userId,
                                            day: today
                                        }
                                    },
                                    data: {
                                        count: {
                                            increment: 1
                                        }
                                    }
                                });
                            } catch (error) {
                                console.error("Failed to update chatbot interaction count:", error);
                            }
                        }
                        
                        // Log interaction for feedback loop
                        try {
                            await db.chatFeedback.create({
                                data: {
                                    userId,
                                    accountId,
                                    query: lastMessageContent,
                                    response: result.text || '',
                                    retrievedEmails: [],
                                    helpful: null, // Will be updated when user gives explicit feedback
                                    interactionType: 'implicit'
                                }
                            });
                        } catch (feedbackError) {
                            console.error("Failed to log feedback:", feedbackError);
                        }
                    }
                });
                
                console.log("Small model response completed, returning cached response");
                const response = result.toUIMessageStreamResponse();
                response.headers.set('X-Accel-Buffering', 'no');
                return response;
            }
        } catch (qaError) {
            console.error("Q&A cache error:", qaError);
            // Continue to expensive model if cache fails
        }

        // ===== STAGE 2: Expensive Model Flow (Original RAG System) =====
        // Track sources used in the response
        type SourceInfo = {
            type: 'email' | 'attachment'
            id: string
            title: string
            threadId?: string
        }
        const sources: SourceInfo[] = []

        // Extract email IDs from context if provided
        const contextEmailIds = emailContext?.emailIds || []
        let contextEmailsText = ''
        let contextEmailIdsForTracking: string[] = []

        // Fetch specific emails if context provided
        if (contextEmailIds.length > 0) {
            try {
                console.log(`Fetching ${contextEmailIds.length} context emails`);
                const contextEmails = await db.email.findMany({
                    where: {
                        id: { in: contextEmailIds },
                        thread: { accountId }
                    },
                    include: { 
                        from: true,
                        thread: true,
                        attachments: true // Include attachments to check if they exist
                    },
                    orderBy: { sentAt: 'asc' }
                })

                if (contextEmails.length > 0) {
                    // Process emails with their attachments
                    const emailContexts = await Promise.all(
                        contextEmails.map(async (email) => {
                            const body = turndown.turndown(email.body ?? email.bodySnippet ?? '')
                            let emailText = `Subject: ${email.subject}\nFrom: ${email.from.name || email.from.address}\nDate: ${new Date(email.sentAt).toLocaleString()}\nBody: ${body}`
                            
                            // Process attachments on-demand if email has them
                            let attachmentTexts: string[] = []
                            if (email.attachments && email.attachments.length > 0) {
                                try {
                                    // Filter out inline attachments and limit to 5 per email
                                    const nonInlineAttachments = email.attachments
                                        .filter(att => {
                                            // Skip inline attachments
                                            if (att.inline) return false
                                            // Skip if size is too large (pre-check)
                                            if (att.size > MAX_FILE_SIZE) {
                                                console.warn(`Skipping attachment ${att.id} - size ${att.size} exceeds limit`)
                                                return false
                                            }
                                            return true
                                        })
                                        .slice(0, 5) // Limit to 5 attachments per email
                                    
                                    if (nonInlineAttachments.length > 0) {
                                        console.log(`Processing ${nonInlineAttachments.length} attachments for email ${email.id}`)
                                        
                                        try {
                                            const attachmentData = await downloadAndProcessAttachments(
                                                nonInlineAttachments.map(att => ({
                                                    attachmentId: att.id,
                                                    emailId: email.id,
                                                    accountId,
                                                    userId
                                                })),
                                                5 // Max 5 attachments per email
                                            )

                                            if (attachmentData.length > 0) {
                                                attachmentTexts = attachmentData.map(data => 
                                                    `File: ${data.fileName}\nContent:\n${data.text}`
                                                )

                                                // Add attachment sources only for successfully processed attachments
                                                attachmentData.forEach((data, index) => {
                                                    const att = nonInlineAttachments[index]
                                                    if (att) {
                                                        sources.push({
                                                            type: 'attachment',
                                                            id: att.id,
                                                            title: att.name,
                                                        })
                                                    }
                                                })
                                                
                                                console.log(`Successfully processed ${attachmentData.length} attachments for email ${email.id}`)
                                            } else {
                                                console.warn(`No attachments were successfully processed for email ${email.id}`)
                                            }
                                        } catch (downloadError) {
                                            console.error(`Error downloading/processing attachments for email ${email.id}:`, downloadError)
                                            // Continue without attachments if processing fails
                                        }
                                    }
                                } catch (attachmentError) {
                                    console.error(`Error processing attachments for email ${email.id}:`, attachmentError)
                                    // Continue without attachments if processing fails
                                }
                            }

                            // Add email to sources
                            sources.push({
                                type: 'email',
                                id: email.id,
                                title: email.subject || '(No subject)',
                                threadId: email.threadId,
                            })

                            // Combine email and attachment text
                            if (attachmentTexts.length > 0) {
                                emailText += '\n\n---\n\nATTACHMENTS:\n\n' + attachmentTexts.join('\n\n---\n\n')
                            }

                            return emailText
                        })
                    )

                    contextEmailsText = emailContexts.join('\n\n---\n\n')
                    contextEmailIdsForTracking = contextEmails.map(e => e.id)
                    
                    console.log(`Fetched ${contextEmails.length} context emails with attachments processed`);
                }
            } catch (error) {
                console.error("Error fetching context emails:", error);
                // Continue without context emails if fetch fails
            }
        }

        // Extract file IDs from context if provided
        const contextFileIds = fileContext?.fileIds || []
        let fileContextText = ''

        // Fetch file attachments if provided
        if (contextFileIds.length > 0) {
            try {
                console.log(`Fetching ${contextFileIds.length} file attachments`);
                const files = await db.chatAttachment.findMany({
                    where: {
                        id: { in: contextFileIds },
                        accountId,
                        userId
                    }
                })

                if (files.length > 0) {
                    fileContextText = files.map(file => 
                        `File: ${file.fileName}\nContent:\n${file.extractedText || ''}`
                    ).join('\n\n---\n\n')

                    // Add to sources
                    files.forEach(file => {
                        sources.push({
                            type: 'attachment',
                            id: file.id,
                            title: file.fileName,
                        })
                    })
                    
                    console.log(`Fetched ${files.length} file attachments`);
                }
            } catch (error) {
                console.error("Error fetching file attachments:", error);
                // Continue without file attachments if fetch fails
            }
        }

        // Perform vector search
        let context;
        try {
            console.log("Initializing OramaClient with accountId:", accountId);
            const oramaManager = new OramaClient(accountId)
            await oramaManager.initialize()
            console.log("OramaClient initialized successfully");
            
            // If context emails provided, prioritize them in search
            context = await oramaManager.vectorSearch({ 
                term: lastMessageContent,
                preferredEmailIds: contextEmailIds.length > 0 ? contextEmailIds : undefined
            })
            console.log("Vector search completed");
        } catch (oramaError) {
            console.error("Orama error:", oramaError);
            const oramaErrorMessage = oramaError instanceof Error ? oramaError.message : String(oramaError);
            console.error("Orama error message:", oramaErrorMessage);
            console.error("Orama error stack:", oramaError instanceof Error ? oramaError.stack : 'No stack');
            // If Orama fails, continue with empty context
            context = { hits: [] };
        }
        
        // Limit context hits and truncate content to prevent context length issues
        const MAX_CONTEXT_HITS = 2; // Reduced to 2 to save tokens
        const MAX_CONTEXT_LENGTH = 1500; // characters per document - reduced to save tokens
        
        // If context emails provided, use fewer vector search results to make room
        const maxVectorHits = contextEmailIds.length > 0 ? Math.max(1, MAX_CONTEXT_HITS - 1) : MAX_CONTEXT_HITS
        const limitedHits = context.hits.slice(0, maxVectorHits);
        console.log(`Using ${limitedHits.length} vector search hits (limited from ${context.hits.length})`);
        
        // Add vector search results to sources
        limitedHits.forEach((hit: any) => {
            const doc = hit.document
            if (doc?.threadId && !sources.find(s => s.id === doc.threadId && s.type === 'email')) {
                sources.push({
                    type: 'email',
                    id: doc.threadId,
                    title: doc.subject || '(No subject)',
                    threadId: doc.threadId,
                })
            }
            // Also track file sources from vector search
            if (doc?.source === 'file' && doc?.sourceId && !sources.find(s => s.id === doc.sourceId && s.type === 'attachment')) {
                sources.push({
                    type: 'attachment',
                    id: doc.sourceId,
                    title: doc.fileName || doc.subject || 'File',
                })
            }
        })

        // Extract retrieved email identifiers for feedback tracking
        const retrievedEmailIds = [
            ...contextEmailIdsForTracking,
            ...limitedHits.map((hit: any) => 
                hit.document?.threadId || hit.document?.subject || ''
            ).filter(Boolean)
        ];
        
        // Truncate context documents to prevent exceeding token limits
        const formatContextDocument = (doc: any) => {
            const truncated = {
                subject: doc.subject?.substring(0, MAX_CONTEXT_LENGTH) || '',
                body: doc.body?.substring(0, MAX_CONTEXT_LENGTH) || '',
                from: doc.from || '',
                sentAt: doc.sentAt || '',
            };
            return truncated;
        };
        
        // Combine context emails with vector search results
        const vectorContextText = limitedHits.length > 0
            ? limitedHits.map((hit) => {
                const doc = formatContextDocument(hit.document);
                return `Subject: ${doc.subject}\nFrom: ${doc.from}\nDate: ${doc.sentAt}\nBody: ${doc.body}`;
            }).join('\n\n---\n\n')
            : '';

        // Combine file context with email context and vector search results
        let contextText = ''
        
        if (fileContextText) {
            contextText = fileContextText
            if (contextEmailsText) {
                contextText += '\n\n---\n\nEMAIL CONTEXT:\n\n' + contextEmailsText
            }
            if (vectorContextText) {
                contextText += '\n\n---\n\nADDITIONAL RELEVANT EMAILS:\n\n' + vectorContextText
            }
        } else if (contextEmailsText) {
            contextText = contextEmailsText
            if (vectorContextText) {
                contextText += '\n\n---\n\nADDITIONAL RELEVANT EMAILS:\n\n' + vectorContextText
            }
        } else {
            contextText = vectorContextText || 'No relevant email context found.'
        }

        // Create a more concise system prompt to save tokens
        const prompt = {
            role: "system",
            content: `You are an AI email assistant. Answer questions about the user's emails using the context below.

TIME: ${new Date().toLocaleString()}

CONTEXT:
${contextText}

GUIDELINES:
- Use context to answer questions
- If context is insufficient, say so politely
- Be concise and helpful
- Don't invent information not in the context
- At the end of your response, mention which sources you used (emails/attachments)`
        };

        // Convert messages to format expected by streamText
        // Include both user and assistant messages for conversation context
        // Limit to last 10 messages (5 user + 5 assistant) to prevent context length issues
        const MAX_MESSAGES = 10;
        const recentMessages = messages.slice(-MAX_MESSAGES);
        
        const formattedMessages = recentMessages.map((message: any) => ({
            role: message.role,
            content: getMessageContent(message)
        })).filter((msg: any) => msg.content && msg.content.trim() !== ''); // Filter out empty messages
        
        console.log(`Using ${formattedMessages.length} messages (from ${messages.length} total)`);

        try {
            console.log("Calling streamText with", formattedMessages.length, "messages");
            const result = await streamText({
                model: openai(LARGE_MODEL),
                messages: [
                    prompt,
                    ...formattedMessages,
                ],
                onFinish: async (result) => {
                    // Update subscription count for free users
                    if (!isSubscribed) {
                        try {
                            await db.chatbotInteraction.update({
                                where: {
                                    day_userId: {
                                        userId,
                                        day: today
                                    }
                                },
                                data: {
                                    count: {
                                        increment: 1
                                    }
                                }
                            });
                        } catch (error) {
                            console.error("Failed to update chatbot interaction count:", error);
                        }
                    }
                    
                    // Log interaction for feedback loop (async, don't block)
                    try {
                        await db.chatFeedback.create({
                            data: {
                                userId,
                                accountId,
                                query: lastMessageContent,
                                response: result.text || '',
                                retrievedEmails: retrievedEmailIds,
                                helpful: null, // Will be updated when user gives explicit feedback
                                interactionType: 'implicit'
                            }
                        });
                    } catch (feedbackError) {
                        // Don't fail the request if feedback logging fails
                        console.error("Failed to log feedback:", feedbackError);
                    }
                    
                    // Add new Q&A to cache for future use (async, don't block)
                    try {
                        const qaCache = new QACacheClient(accountId);
                        await qaCache.initialize();
                        await qaCache.addQA(lastMessageContent, result.text || '', null);
                        console.log("Added new Q&A to cache");
                    } catch (cacheError) {
                        console.error("Failed to add Q&A to cache:", cacheError);
                    }
                    
                    // Store sources for this response (we'll need to pass them to the client)
                    // Note: Sources will be included in the response metadata
                    console.log("Sources used in response:", sources);
                },
            });

            console.log("streamText completed, returning response");
            // Return response in format compatible with useChat hook
            // toUIMessageStreamResponse() formats the response correctly for useChat with DefaultChatTransport
            const response = result.toUIMessageStreamResponse();
            // Ensure proper headers for streaming
            response.headers.set('X-Accel-Buffering', 'no');
            console.log("Response headers:", Object.fromEntries(response.headers.entries()));
            console.log("Response status:", response.status);
            return response;
        } catch (streamError) {
            console.error("streamText error:", streamError);
            const streamErrorMessage = streamError instanceof Error ? streamError.message : String(streamError);
            const streamErrorStack = streamError instanceof Error ? streamError.stack : 'No stack';
            console.error("streamText error message:", streamErrorMessage);
            console.error("streamText error stack:", streamErrorStack);
            throw streamError;
        }
    } catch (error) {
        console.error("Chat API error:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        const errorStack = error instanceof Error ? error.stack : undefined;
        console.error("Error stack:", errorStack);
        return NextResponse.json({ 
            error: "Internal server error",
            message: errorMessage 
        }, { status: 500 });
    }
}