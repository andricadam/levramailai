"use server"
import { db } from "@/server/db";
import type { EmailMessage, EmailAddress as AurinkoEmailAddress } from "@/types";

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
    const hasInbox = emails.some(e => {
        const labels = sysLabelsLower(e.sysLabels);
        return labels.includes("inbox") && !labels.includes("sent") && !labels.includes("draft") && !labels.includes("spam") && !labels.includes("junk");
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
    const emailAddress = await db.emailAddress.upsert({
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
    
    return emailAddress.id;
}

/**
 * Syncs emails to the database, creating threads, emails, and related records
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
        
        // Extract participant IDs
        const participantIds = extractParticipantIds(threadEmails);
        
        // Create or update the thread
        // Use Aurinko's threadId as our thread ID
        const thread = await db.thread.upsert({
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

        // Process each email in the thread
        for (const email of threadEmails) {
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
            
            await db.email.upsert({
                where: { id: email.id },
                create: {
                    id: email.id,
                    threadId: thread.id,
                    createdTime: createdTimeDate,
                    lastModifiedTime: lastModifiedTimeDate,
                    sentAt: sentAtDate,
                    receivedAt: receivedAtDate,
                    internetMessageId: email.internetMessageId,
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
                    emailLabel: mapEmailLabel(email.sysLabels),
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
                update: {
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
                    emailLabel: mapEmailLabel(email.sysLabels),
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
                },
            });

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

    console.log(`Successfully synced ${emails.length} emails across ${emailsByThread.size} threads`);
}

