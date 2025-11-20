import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

import { NextResponse } from "next/server";
import { OramaClient } from "@/lib/orama";
import { db } from "@/server/db";
import { auth } from "@clerk/nextjs/server";
import { getSubscriptionStatus } from "@/lib/stripe-actions";
import { FREE_CREDITS_PER_DAY } from "@/app/constants";

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
        
        const { messages, accountId } = body;
        
        console.log("Extracted values - messages:", messages?.length, "accountId:", accountId);
        
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

        let context;
        try {
            console.log("Initializing OramaClient with accountId:", accountId);
            const oramaManager = new OramaClient(accountId)
            await oramaManager.initialize()
            console.log("OramaClient initialized successfully");
            context = await oramaManager.vectorSearch({ term: lastMessageContent })
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
        
        const limitedHits = context.hits.slice(0, MAX_CONTEXT_HITS);
        console.log(`Using ${limitedHits.length} context hits (limited from ${context.hits.length})`);
        
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
        
        const contextText = limitedHits.length > 0
            ? limitedHits.map((hit) => {
                const doc = formatContextDocument(hit.document);
                return `Subject: ${doc.subject}\nFrom: ${doc.from}\nDate: ${doc.sentAt}\nBody: ${doc.body}`;
            }).join('\n\n---\n\n')
            : 'No relevant email context found.';

        // Create a more concise system prompt to save tokens
        const prompt = {
            role: "system",
            content: `You are an AI email assistant. Answer questions about the user's emails using the context below.

TIME: ${new Date().toLocaleString()}

EMAIL CONTEXT:
${contextText}

GUIDELINES:
- Use email context to answer questions
- If context is insufficient, say so politely
- Be concise and helpful
- Don't invent information not in the context`
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
                model: openai("gpt-4"),
                messages: [
                    prompt,
                    ...formattedMessages,
                ],
                onFinish: async () => {
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