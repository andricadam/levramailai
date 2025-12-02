"use server"
import { db, retryDbOperation } from "@/server/db";
import type { EmailMessage, EmailAddress as AurinkoEmailAddress } from "@/types";
import { OramaClient } from "./orama";
import { getEmbeddings } from "./embedding";
import { turndown } from "./turndown";
import { determineEmailPriority } from "@/app/mail/components/ai/priority";
import { shouldGenerateReply } from "@/app/mail/components/ai/instant-reply/should-reply";
import { generateInstantReplyServer } from "@/app/mail/components/ai/instant-reply/generate-reply-server";

/**
 * Safely parses a date string to a Date object, with fallback handling
 * @param dateString - The date string to parse
 * @param fallback - Optional fallback date string to use if parsing fails
 * @returns A valid Date object
 */
function safeDateParse(dateString: string | null | undefined, fallback?: string): Date {
    // Try to parse the primary date string
    if (dateString) {
        const date = new Date(dateString);
        if (!isNaN(date.getTime())) {
            return date;
        }
    }
    
    // Try fallback if provided
    if (fallback) {
        const fallbackDate = new Date(fallback);
        if (!isNaN(fallbackDate.getTime())) {
            return fallbackDate;
        }
    }
    
    // Last resort: use current date
    console.warn(`Invalid date string: ${dateString}, using current date as fallback`);
    return new Date();
}

/**
 * Maps Aurinko sysLabels to emailLabel enum
 */
function mapEmailLabel(sysLabels: EmailMessage["sysLabels"]): "inbox" | "sent" | "draft" | "spam" | "junk" {
    const sysLabelsLower = sysLabels.map(label => label.toLowerCase());
    // Check for spam/junk first (they take priority)
    if (sysLabelsLower.includes("spam")) return "spam";
    if (sysLabelsLower.includes("junk")) return "junk";
    if (sysLabels.includes("draft")) return "draft";
    if (sysLabels.includes("sent")) return "sent";
    return "inbox";
}

/**
 * Determines thread status flags from emails in the thread
 */
function determineThreadStatus(emails: EmailMessage[]) {
    const sysLabelsLower = (labels: string[]) => labels.map(l => l.toLowerCase());
    // Check if any email has "inbox" label (even if it also has "sent" - incoming emails can be in both)
    const hasInbox = emails.some(e => {
        const labels = sysLabelsLower(e.sysLabels);
        // An email is considered "inbox" if it has the inbox label and is not spam/junk/draft
        // Note: "sent" label doesn't prevent inbox status - an email can be both sent and in inbox
        return labels.includes("inbox") && !labels.includes("draft") && !labels.includes("spam") && !labels.includes("junk");
    });
    const hasSent = emails.some(e => sysLabelsLower(e.sysLabels).includes("sent"));
    const hasDraft = emails.some(e => sysLabelsLower(e.sysLabels).includes("draft"));
    const hasSpam = emails.some(e => sysLabelsLower(e.sysLabels).includes("spam"));
    const hasJunk = emails.some(e => sysLabelsLower(e.sysLabels).includes("junk"));
    
    return {
        inboxStatus: hasInbox && !hasSpam && !hasJunk,
        draftStatus: hasDraft && !hasSpam && !hasJunk,
        sentStatus: hasSent && !hasSpam && !hasJunk,
        spamStatus: hasSpam,
        junkStatus: hasJunk,
    };
}

/**
 * Extracts all unique participant email addresses from emails
 */
function extractParticipantIds(emails: EmailMessage[]): string[] {
    const participants = new Set<string>();
    
    emails.forEach(email => {
        // Add from address
        if (email.from?.address) {
            participants.add(email.from.address);
        }
        // Add to addresses
        email.to?.forEach(addr => {
            if (addr?.address) participants.add(addr.address);
        });
        // Add cc addresses
        email.cc?.forEach(addr => {
            if (addr?.address) participants.add(addr.address);
        });
        // Add bcc addresses
        email.bcc?.forEach(addr => {
            if (addr?.address) participants.add(addr.address);
        });
        // Add replyTo addresses
        email.replyTo?.forEach(addr => {
            if (addr?.address) participants.add(addr.address);
        });
    });
    
    return Array.from(participants);
}

/**
 * Ensures an EmailAddress exists in the database, returns its ID
 */
async function ensureEmailAddress(
    accountId: string,
    address: AurinkoEmailAddress
): Promise<string> {
    const emailAddress = await retryDbOperation(
        async () => {
            return await db.emailAddress.upsert({
                where: {
                    accountId_address: {
                        accountId,
                        address: address.address,
                    },
                },
                create: {
                    accountId,
                    address: address.address,
                    name: address.name || null,
                    raw: address.raw || null,
                },
                update: {
                    name: address.name || null,
                    raw: address.raw || null,
                },
            });
        },
        3,
        1000
    );
    
    return emailAddress.id;
}

/**
 * Syncs emails to the database, creating threads, emails, and related records
 * Also vectorizes emails and stores them in Orama for RAG, and generates instant replies
 */
export async function syncEmailsToDatabase(
    accountId: string,
    emails: EmailMessage[]
): Promise<void> {
    if (emails.length === 0) {
        console.log("No emails to sync");
        return;
    }

    console.log(`Starting sync for ${emails.length} emails...`);

    // Initialize Orama client for vectorization
    const orama = new OramaClient(accountId);
    await orama.initialize();
    const oramaDocuments: any[] = [];

    // Group emails by threadId
    const emailsByThread = new Map<string, EmailMessage[]>();
    emails.forEach(email => {
        const threadId = email.threadId;
        if (!emailsByThread.has(threadId)) {
            emailsByThread.set(threadId, []);
        }
        emailsByThread.get(threadId)!.push(email);
    });

    console.log(`Found ${emailsByThread.size} unique threads`);

    // Process each thread
    for (const [aurinkoThreadId, threadEmails] of emailsByThread.entries()) {
        // Sort emails by sentAt to get the latest message date
        const sortedEmails = [...threadEmails].sort(
            (a, b) => safeDateParse(a.sentAt).getTime() - safeDateParse(b.sentAt).getTime()
        );
        
        const lastEmail = sortedEmails[sortedEmails.length - 1];
        const firstEmail = sortedEmails[0];
        
        // Determine thread status
        const threadStatus = determineThreadStatus(threadEmails);
        
        // DEBUG: Log thread status determination for debugging
        console.log(`[DEBUG] Thread ${aurinkoThreadId} - Subject: "${firstEmail.subject || "(No subject)"}"`);
        console.log(`[DEBUG] Thread ${aurinkoThreadId} - Thread Status:`, JSON.stringify(threadStatus, null, 2));
        console.log(`[DEBUG] Thread ${aurinkoThreadId} - Emails in thread:`, threadEmails.map(e => ({
            id: e.id,
            subject: e.subject,
            from: e.from.address,
            sysLabels: e.sysLabels,
            emailLabelType: mapEmailLabel(e.sysLabels)
        })));
        
        // Extract participant IDs
        const participantIds = extractParticipantIds(threadEmails);
        
        // Create or update the thread
        // Use Aurinko's threadId as our thread ID
        const thread = await retryDbOperation(
            async () => {
                return await db.thread.upsert({
                    where: { id: aurinkoThreadId },
                    create: {
                        id: aurinkoThreadId,
                        accountId,
                        subject: firstEmail.subject || "(No subject)",
                        lastMessageDate: safeDateParse(lastEmail.sentAt),
                        participantIds,
                        ...threadStatus,
                    },
                    update: {
                        subject: firstEmail.subject || "(No subject)",
                        lastMessageDate: safeDateParse(lastEmail.sentAt),
                        participantIds,
                        ...threadStatus,
                    },
                });
            },
            3,
            1000
        );
        
        // DEBUG: Log final thread status after upsert
        console.log(`[DEBUG] Thread ${aurinkoThreadId} upserted successfully - inboxStatus: ${threadStatus.inboxStatus}, sentStatus: ${threadStatus.sentStatus}, spamStatus: ${threadStatus.spamStatus}`);

        // Process each email in the thread
        for (const email of threadEmails) {
            // Determine email label type
            const emailLabelType = mapEmailLabel(email.sysLabels);
            
            // DEBUG: Log email label type and sysLabels for all emails
            console.log(`[DEBUG] Email ${email.id} - Subject: "${email.subject || "(No subject)"}", From: ${email.from.address}`);
            console.log(`[DEBUG] Email ${email.id} - sysLabels:`, email.sysLabels);
            console.log(`[DEBUG] Email ${email.id} - emailLabelType: ${emailLabelType}`);
            
            // Log if email is being marked as inbox for debugging
            if (emailLabelType === 'inbox') {
                console.log(`[DEBUG] Email ${email.id} (${email.subject}) marked as inbox with labels:`, email.sysLabels);
            } else {
                console.log(`[DEBUG] Email ${email.id} (${email.subject}) NOT marked as inbox - emailLabelType: ${emailLabelType}, sysLabels:`, email.sysLabels);
            }

            // Determine priority for inbox emails only
            let emailPriority: 'high' | 'medium' | 'low' = 'medium';
            if (emailLabelType === 'inbox') {
                // Check if Gmail has marked this email as important
                if (email.sysLabels.includes('important')) {
                    emailPriority = 'high';
                } else {
                    // Otherwise, use AI to determine priority
                    try {
                        emailPriority = await determineEmailPriority(
                            email.body ?? email.bodySnippet ?? '',
                            email.subject || "(No subject)",
                            email.from.name || email.from.address,
                            new Date(email.sentAt).toLocaleString()
                        );
                    } catch (error) {
                        console.error(`Error determining priority for email ${email.id}:`, error);
                        emailPriority = 'medium';
                    }
                }
            }

            // Determine if we should generate an auto-reply draft
            let autoReplyDraft: string | null = null;

            // Only generate for incoming inbox emails (not sent, drafts, spam, or junk)
            if (emailLabelType === 'inbox') {
                try {
                    const shouldReply = await shouldGenerateReply(
                        email.body ?? email.bodySnippet ?? '',
                        email.subject || "(No subject)",
                        email.from.name || email.from.address,
                        new Date(email.sentAt).toLocaleString(),
                        email.sysLabels,
                        email.sysClassifications || []
                    );

                    // If eligible, generate the reply draft
                    if (shouldReply) {
                        try {
                            // Get account info for context
                            const account = await retryDbOperation(
                                async () => {
                                    return await db.account.findUnique({
                                        where: { id: accountId },
                                        select: { name: true, emailAddress: true }
                                    });
                                },
                                3,
                                1000
                            );

                            // Build context from thread emails (existing ones in DB)
                            const existingThreadEmails = await retryDbOperation(
                                async () => {
                                    return await db.email.findMany({
                                        where: { threadId: email.threadId },
                                        orderBy: { sentAt: 'asc' },
                                        include: { from: true }
                                    });
                                },
                                3,
                                1000
                            );

                            let context = '';
                            // Add existing thread emails
                            for (const threadEmail of existingThreadEmails) {
                                context += `
Subject: ${threadEmail.subject}
From: ${threadEmail.from.address}
Sent: ${new Date(threadEmail.sentAt).toLocaleString()}
Body: ${turndown.turndown(threadEmail.body ?? threadEmail.bodySnippet ?? "")}

`;
                            }
                            
                            // Add the current email being processed
                            context += `
Subject: ${email.subject || "(No subject)"}
From: ${email.from.address}
Sent: ${new Date(email.sentAt).toLocaleString()}
Body: ${turndown.turndown(email.body ?? email.bodySnippet ?? "")}

`;
                            
                            if (account) {
                                context += `
My name is ${account.name} and my email is ${account.emailAddress}.
`;
                            }

                            // Generate the reply (server-side, non-streaming)
                            autoReplyDraft = await generateInstantReplyServer(context);
                            console.log(`Generated auto-reply draft for email ${email.id}`);
                        } catch (replyError) {
                            console.error(`Error generating reply draft for email ${email.id}:`, replyError);
                            // Continue without draft if generation fails
                        }
                    }
                } catch (error) {
                    console.error(`Error determining reply eligibility for email ${email.id}:`, error);
                }
            }

            // Vectorize email for RAG
            const body = turndown.turndown(email.body ?? email.bodySnippet ?? '');
            let embeddings: number[] | null = null;
            
            try {
                // Generate embeddings from full email context (subject + body + sender) for better search
                const emailText = `Subject: ${email.subject || "(No subject)"}\nFrom: ${email.from.name || email.from.address}\nBody: ${body}`;
                embeddings = await getEmbeddings(emailText);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                
                // Check if it's a quota error
                if (errorMessage.includes("quota") || errorMessage.includes("exceeded") || errorMessage.includes("billing")) {
                    console.warn(`[QUOTA] Skipping vectorization for email ${email.id} - OpenAI quota exceeded. Email will be synced without embeddings but still searchable via keyword.`);
                } else {
                    console.error(`Error vectorizing email ${email.id}:`, error);
                }
                // Continue without embeddings - email will still be searchable via keyword search
            }
            
            // Always add email to Orama, even without embeddings (for keyword search)
            // This ensures emails are searchable even if vectorization fails
            oramaDocuments.push({
                subject: email.subject || "(No subject)",
                body: body,
                rowBody: email.bodySnippet ?? '',
                from: email.from.address,
                to: email.to.map(to => to.address),
                sentAt: new Date(email.sentAt).toLocaleString(),
                threadId: email.threadId,
                source: 'email', // CRITICAL: Add source field to identify as email
                sourceId: email.id, // CRITICAL: Add sourceId to link back to email
                fileName: '', // Not applicable for emails
                embeddings: embeddings || [] // Use empty array if no embeddings (allows keyword search)
            });

            // Ensure email addresses exist
            const fromId = await ensureEmailAddress(accountId, email.from);
            
            const toIds: string[] = [];
            for (const addr of email.to || []) {
                const id = await ensureEmailAddress(accountId, addr);
                toIds.push(id);
            }
            
            const ccIds: string[] = [];
            for (const addr of email.cc || []) {
                const id = await ensureEmailAddress(accountId, addr);
                ccIds.push(id);
            }
            
            const bccIds: string[] = [];
            for (const addr of email.bcc || []) {
                const id = await ensureEmailAddress(accountId, addr);
                bccIds.push(id);
            }
            
            const replyToIds: string[] = [];
            for (const addr of email.replyTo || []) {
                const id = await ensureEmailAddress(accountId, addr);
                replyToIds.push(id);
            }

            // Map sensitivity
            const sensitivity = email.sensitivity || "normal";
            if (!["normal", "private", "personal", "confidential"].includes(sensitivity)) {
                console.warn(`Unknown sensitivity value: ${sensitivity}, defaulting to normal`);
            }

            // Map meetingMessageMethod
            let meetingMessageMethod: "request" | "reply" | "cancel" | "counter" | "other" | null = null;
            if (email.meetingMessageMethod) {
                if (["request", "reply", "cancel", "counter", "other"].includes(email.meetingMessageMethod)) {
                    meetingMessageMethod = email.meetingMessageMethod;
                }
            }

            // Create or update the email
            // Parse dates safely, using sentAt as fallback for lastModifiedTime if needed
            const sentAtDate = safeDateParse(email.sentAt);
            const createdTimeDate = safeDateParse(email.createdTime, email.sentAt);
            const lastModifiedTimeDate = safeDateParse(email.lastModifiedTime, email.sentAt);
            const receivedAtDate = safeDateParse(email.receivedAt, email.sentAt);
            
            // Prepare email data to avoid duplication
            const emailUpdateData = {
                createdTime: createdTimeDate,
                lastModifiedTime: lastModifiedTimeDate,
                sentAt: sentAtDate,
                receivedAt: receivedAtDate,
                subject: email.subject || "(No subject)",
                sysLabels: email.sysLabels,
                keywords: email.keywords || [],
                sysClassifications: email.sysClassifications || [],
                sensitivity: sensitivity as "normal" | "private" | "personal" | "confidential",
                meetingMessageMethod,
                fromId,
                hasAttachments: email.hasAttachments || false,
                body: email.body || null,
                bodySnippet: email.bodySnippet || null,
                inReplyTo: email.inReplyTo || null,
                references: email.references || null,
                threadIndex: email.threadIndex || null,
                internetHeaders: email.internetHeaders as unknown as any[],
                nativeProperties: email.nativeProperties as unknown as Record<string, any>,
                folderId: email.folderId || null,
                omitted: email.omitted || [],
                emailLabel: emailLabelType,
                priority: emailPriority,
                autoReplyDraft: autoReplyDraft,
                to: {
                    set: toIds.map(id => ({ id })),
                },
                cc: {
                    set: ccIds.map(id => ({ id })),
                },
                bcc: {
                    set: bccIds.map(id => ({ id })),
                },
                replyTo: {
                    set: replyToIds.map(id => ({ id })),
                },
            };

            try {
                await retryDbOperation(
                    async () => {
                        return await db.email.upsert({
                            where: { id: email.id },
                            create: {
                                id: email.id,
                                threadId: thread.id,
                                internetMessageId: email.internetMessageId,
                                ...emailUpdateData,
                                to: {
                                    connect: toIds.map(id => ({ id })),
                                },
                                cc: {
                                    connect: ccIds.map(id => ({ id })),
                                },
                                bcc: {
                                    connect: bccIds.map(id => ({ id })),
                                },
                                replyTo: {
                                    connect: replyToIds.map(id => ({ id })),
                                },
                            },
                            update: emailUpdateData,
                        });
                    },
                    3,
                    1000
                );
            } catch (error: any) {
                // Handle unique constraint violation (race condition)
                // If email already exists due to concurrent processing, just update it
                const isUniqueConstraintError = 
                    error?.code === 'P2002' || 
                    (error?.message && error.message.includes('Unique constraint failed'));
                
                if (isUniqueConstraintError) {
                    console.warn(`Email ${email.id} already exists (likely race condition), updating instead...`);
                    try {
                        await retryDbOperation(
                            async () => {
                                return await db.email.update({
                                    where: { id: email.id },
                                    data: emailUpdateData,
                                });
                            },
                            3,
                            1000
                        );
                    } catch (updateError: any) {
                        // If update fails (email doesn't exist after all), try to find it first
                        const existingEmail = await retryDbOperation(
                            async () => {
                                return await db.email.findUnique({
                                    where: { id: email.id },
                                });
                            },
                            3,
                            1000
                        );
                        
                        if (!existingEmail) {
                            // Email doesn't exist, log the error but continue
                            console.error(`Email ${email.id} not found during error recovery:`, updateError);
                            throw error; // Re-throw original error
                        }
                        // Email exists, update should have worked, log and continue
                        console.warn(`Email ${email.id} updated successfully after error recovery`);
                    }
                } else {
                    // Re-throw if it's a different error
                    console.error(`Error upserting email ${email.id}:`, error);
                    throw error;
                }
            }

            // Create or update attachments
            if (email.attachments && email.attachments.length > 0) {
                for (const attachment of email.attachments) {
                    await db.emailAttachment.upsert({
                        where: { id: attachment.id },
                        create: {
                            id: attachment.id,
                            emailId: email.id,
                            name: attachment.name,
                            mimeType: attachment.mimeType,
                            size: attachment.size,
                            inline: attachment.inline || false,
                            contentId: attachment.contentId || null,
                            content: attachment.content || null,
                            contentLocation: attachment.contentLocation || null,
                        },
                        update: {
                            name: attachment.name,
                            mimeType: attachment.mimeType,
                            size: attachment.size,
                            inline: attachment.inline || false,
                            contentId: attachment.contentId || null,
                            content: attachment.content || null,
                            contentLocation: attachment.contentLocation || null,
                        },
                    });
                }
            }
        }
    }

    // Batch insert all Orama documents and save index once
    if (oramaDocuments.length > 0) {
        console.log(`Vectorizing and inserting ${oramaDocuments.length} emails into Orama...`);
        await orama.insertBatch(oramaDocuments);
        console.log(`Successfully vectorized and stored ${oramaDocuments.length} emails in Orama`);
    }

    console.log(`Successfully synced ${emails.length} emails across ${emailsByThread.size} threads`);
}

