import { db } from '@/server/db';
import type { SyncUpdatedResponse, EmailMessage, EmailAddress, EmailAttachment, EmailHeader } from '@/types';
import { OramaClient } from './orama';
// TODO: Implement these modules
import { getEmbeddings } from '@/lib/embedding';
import { turndown } from './turndown';
import { determineEmailPriority } from '@/app/mail/components/ai/priority';
import { shouldGenerateReply } from '@/app/mail/components/ai/instant-reply/should-reply';
import { generateInstantReplyServer } from '@/app/mail/components/ai/instant-reply/generate-reply-server';

async function syncEmailsToDatabase(emails: EmailMessage[], accountId: string) {
    console.log(`attempting to sync emails to database ${emails.length}`)


    const orama = new OramaClient(accountId)
    await orama.initialize()
    try {
        // Sync emails to database
        for (const [index, email] of emails.entries()) {
            const body = turndown.turndown(email.body ?? email.bodySnippet ?? '')
            const embeddings = await getEmbeddings(body)
            await orama.insert({
                subject: email.subject,
                body: body,
                from: email.from.address,
                rawBody: email.bodySnippet ?? '',
                to: email.to.map(to => to.address),
                sentAt: email.sentAt.toLocaleString(),
                threadId: email.threadId,
                embeddings
            })
            await upsertEmail(email, index, accountId);
        }

        // TODO: Implement Orama sync when modules are available
        // const limit = pLimit(10);
        // const oramaClient = new OramaManager(accountId)
        // oramaClient.initialize()
        // async function syncToOrama() {
        //     await Promise.all(emails.map(email => {
        //         return limit(async () => {
        //             const body = turndown.turndown(email.body ?? email.bodySnippet ?? '')
        //             const payload = `From: ${email.from.name} <${email.from.address}>\nTo: ${email.to.map(t => `${t.name} <${t.address}>`).join(', ')}\nSubject: ${email.subject}\nBody: ${body}\n SentAt: ${new Date(email.sentAt).toLocaleString()}`
        //             const bodyEmbedding = await getEmbeddings(payload);
        //             await oramaClient.insert({
        //                 title: email.subject,
        //                 body: body,
        //                 rawBody: email.bodySnippet ?? '',
        //                 from: `${email.from.name} <${email.from.address}>`,
        //                 to: email.to.map(t => `${t.name} <${t.address}>`),
        //                 sentAt: new Date(email.sentAt).toLocaleString(),
        //                 embeddings: bodyEmbedding,
        //                 threadId: email.threadId
        //             })
        //         })
        //     }))
        // }
        // await Promise.all([syncToOrama(), syncToDB()])
        // await oramaClient.saveIndex()
    } catch (error) {
        console.log('error', error)
    }

}

async function upsertEmail(email: EmailMessage, index: number, accountId: string) {
    console.log(`upserting email ${index}`);
    try {

        // determine email label type
        // Check for spam/junk first (they take priority)
        const sysLabelsLower = email.sysLabels.map(label => label.toLowerCase())
        let emailLabelType: 'inbox' | 'sent' | 'draft' | 'spam' | 'junk' = 'inbox'
        
        if (sysLabelsLower.includes('spam')) {
            emailLabelType = 'spam'
        } else if (sysLabelsLower.includes('junk')) {
            emailLabelType = 'junk'
        } else if (email.sysLabels.includes('inbox') || email.sysLabels.includes('important')) {
            emailLabelType = 'inbox'
        } else if (email.sysLabels.includes('sent')) {
            emailLabelType = 'sent'
        } else if (email.sysLabels.includes('draft')) {
            emailLabelType = 'draft'
        }

        // Determine priority for inbox emails only
        let emailPriority: 'high' | 'medium' | 'low' = 'medium';
        if (emailLabelType === 'inbox') {
            try {
                emailPriority = await determineEmailPriority(
                    email.body ?? email.bodySnippet ?? '',
                    email.subject,
                    email.from.name || email.from.address,
                    new Date(email.sentAt).toLocaleString()
                );
            } catch (error) {
                console.error(`Error determining priority for email ${email.id}:`, error);
                // Default to medium on error
                emailPriority = 'medium';
            }
        }

        // Determine if we should generate an auto-reply draft
        let autoReplyDraft: string | null = null;

        // Only generate for incoming inbox emails (not sent, drafts, spam, or junk)
        if (emailLabelType === 'inbox') {
            try {
                const shouldReply = await shouldGenerateReply(
                    email.body ?? email.bodySnippet ?? '',
                    email.subject,
                    email.from.name || email.from.address,
                    new Date(email.sentAt).toLocaleString(),
                    email.sysLabels,
                    email.sysClassifications
                );

                // If eligible, generate the reply draft
                if (shouldReply) {
                    try {
                        // Get account info for context
                        const account = await db.account.findUnique({
                            where: { id: accountId },
                            select: { name: true, emailAddress: true }
                        });

                        // Build context from thread emails (existing ones in DB)
                        const threadEmails = await db.email.findMany({
                            where: { threadId: email.threadId },
                            orderBy: { sentAt: 'asc' },
                            include: { from: true }
                        });

                        let context = '';
                        // Add existing thread emails
                        for (const threadEmail of threadEmails) {
                            context += `
Subject: ${threadEmail.subject}
From: ${threadEmail.from.address}
Sent: ${new Date(threadEmail.sentAt).toLocaleString()}
Body: ${turndown.turndown(threadEmail.body ?? threadEmail.bodySnippet ?? "")}

`;
                        }
                        
                        // Add the current email being processed
                        context += `
Subject: ${email.subject}
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

        // 1. Upsert EmailAddress records
        const addressesToUpsert = new Map()
        for (const address of [email.from, ...email.to, ...email.cc, ...email.bcc, ...email.replyTo]) {
            addressesToUpsert.set(address.address, address);
        }

        const upsertedAddresses: (Awaited<ReturnType<typeof upsertEmailAddress>> | null)[] = [];

        for (const address of addressesToUpsert.values()) {
            const upsertedAddress = await upsertEmailAddress(address, accountId);
            upsertedAddresses.push(upsertedAddress);
        }

        const addressMap = new Map(
            upsertedAddresses.filter(Boolean).map(address => [address!.address, address])
        );

        const fromAddress = addressMap.get(email.from.address);
        if (!fromAddress) {
            console.log(`Failed to upsert from address for email ${email.bodySnippet}`);
            return;
        }

        const toAddresses = email.to.map(addr => addressMap.get(addr.address)).filter(Boolean);
        const ccAddresses = email.cc.map(addr => addressMap.get(addr.address)).filter(Boolean);
        const bccAddresses = email.bcc.map(addr => addressMap.get(addr.address)).filter(Boolean);
        const replyToAddresses = email.replyTo.map(addr => addressMap.get(addr.address)).filter(Boolean);

        // 2. Upsert Thread
        const thread = await db.thread.upsert({
            where: { id: email.threadId },
            update: {
                subject: email.subject,
                accountId,
                lastMessageDate: new Date(email.sentAt),
                done: false,
                participantIds: [...new Set([
                    fromAddress.id,
                    ...toAddresses.map(a => a!.id),
                    ...ccAddresses.map(a => a!.id),
                    ...bccAddresses.map(a => a!.id)
                ])]
            },
            create: {
                id: email.threadId,
                accountId,
                subject: email.subject,
                done: false,
                draftStatus: emailLabelType === 'draft',
                inboxStatus: emailLabelType === 'inbox',
                sentStatus: emailLabelType === 'sent',
                spamStatus: emailLabelType === 'spam',
                junkStatus: emailLabelType === 'junk',
                lastMessageDate: new Date(email.sentAt),
                participantIds: [...new Set([
                    fromAddress.id,
                    ...toAddresses.map(a => a!.id),
                    ...ccAddresses.map(a => a!.id),
                    ...bccAddresses.map(a => a!.id)
                ])]
            }
        });

        // 3. Upsert Email
        await db.email.upsert({
            where: { id: email.id },
            update: {
                threadId: thread.id,
                createdTime: new Date(email.createdTime),
                lastModifiedTime: new Date(),
                sentAt: new Date(email.sentAt),
                receivedAt: new Date(email.receivedAt),
                internetMessageId: email.internetMessageId,
                subject: email.subject,
                sysLabels: email.sysLabels,
                keywords: email.keywords,
                sysClassifications: email.sysClassifications,
                sensitivity: email.sensitivity,
                meetingMessageMethod: email.meetingMessageMethod,
                fromId: fromAddress.id,
                to: { set: toAddresses.map(a => ({ id: a!.id })) },
                cc: { set: ccAddresses.map(a => ({ id: a!.id })) },
                bcc: { set: bccAddresses.map(a => ({ id: a!.id })) },
                replyTo: { set: replyToAddresses.map(a => ({ id: a!.id })) },
                hasAttachments: email.hasAttachments,
                internetHeaders: email.internetHeaders as any,
                body: email.body,
                bodySnippet: email.bodySnippet,
                inReplyTo: email.inReplyTo,
                references: email.references,
                threadIndex: email.threadIndex,
                nativeProperties: email.nativeProperties as any,
                folderId: email.folderId,
                omitted: email.omitted,
                emailLabel: emailLabelType,
                priority: emailPriority,
                autoReplyDraft: autoReplyDraft,
            },
            create: {
                id: email.id,
                emailLabel: emailLabelType,
                priority: emailPriority,
                autoReplyDraft: autoReplyDraft,
                threadId: thread.id,
                createdTime: new Date(email.createdTime),
                lastModifiedTime: new Date(),
                sentAt: new Date(email.sentAt),
                receivedAt: new Date(email.receivedAt),
                internetMessageId: email.internetMessageId,
                subject: email.subject,
                sysLabels: email.sysLabels,
                internetHeaders: email.internetHeaders as any,
                keywords: email.keywords,
                sysClassifications: email.sysClassifications,
                sensitivity: email.sensitivity,
                meetingMessageMethod: email.meetingMessageMethod,
                fromId: fromAddress.id,
                to: { connect: toAddresses.map(a => ({ id: a!.id })) },
                cc: { connect: ccAddresses.map(a => ({ id: a!.id })) },
                bcc: { connect: bccAddresses.map(a => ({ id: a!.id })) },
                replyTo: { connect: replyToAddresses.map(a => ({ id: a!.id })) },
                hasAttachments: email.hasAttachments,
                body: email.body,
                bodySnippet: email.bodySnippet,
                inReplyTo: email.inReplyTo,
                references: email.references,
                threadIndex: email.threadIndex,
                nativeProperties: email.nativeProperties as any,
                folderId: email.folderId,
                omitted: email.omitted,
            }
        });


        const threadEmails = await db.email.findMany({
            where: { threadId: thread.id },
            orderBy: { receivedAt: 'asc' }
        });

        let threadFolderType = 'sent';
        for (const threadEmail of threadEmails) {
            if (threadEmail.emailLabel === 'inbox') {
                threadFolderType = 'inbox';
                break; // If any email is in inbox, the whole thread is in inbox
            } else if (threadEmail.emailLabel === 'spam') {
                threadFolderType = 'spam';
                break; // If any email is spam, the whole thread is spam
            } else if (threadEmail.emailLabel === 'junk') {
                threadFolderType = 'junk';
                break; // If any email is junk, the whole thread is junk
            } else if (threadEmail.emailLabel === 'draft') {
                threadFolderType = 'draft'; // Set to draft, but continue checking for inbox/spam/junk
            }
        }
        await db.thread.update({
            where: { id: thread.id },
            data: {
                draftStatus: threadFolderType === 'draft',
                inboxStatus: threadFolderType === 'inbox',
                sentStatus: threadFolderType === 'sent',
                spamStatus: threadFolderType === 'spam',
                junkStatus: threadFolderType === 'junk',
            }
        });

        // 4. Upsert Attachments
        for (const attachment of email.attachments) {
            await upsertAttachment(email.id, attachment);
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(`Error for email ${email.id}:`, errorMessage);
    }
}

async function upsertEmailAddress(address: EmailAddress, accountId: string) {
    try {
        const existingAddress = await db.emailAddress.findUnique({
            where: { accountId_address: { accountId: accountId, address: address.address ?? "" } },
        });

        if (existingAddress) {
            return await db.emailAddress.update({
                where: { id: existingAddress.id },
                data: { name: address.name, raw: address.raw },
            });
        } else {
            return await db.emailAddress.create({
                data: { address: address.address ?? "", name: address.name, raw: address.raw, accountId },
            });
        }
    } catch (error) {
        console.log(`Failed to upsert email address: ${error}`);
        return null;
    }
}
async function upsertAttachment(emailId: string, attachment: EmailAttachment) {
    try {
        await db.emailAttachment.upsert({
            where: { id: attachment.id ?? "" },
            update: {
                name: attachment.name,
                mimeType: attachment.mimeType,
                size: attachment.size,
                inline: attachment.inline,
                contentId: attachment.contentId,
                content: attachment.content,
                contentLocation: attachment.contentLocation,
            },
            create: {
                id: attachment.id,
                emailId,
                name: attachment.name,
                mimeType: attachment.mimeType,
                size: attachment.size,
                inline: attachment.inline,
                contentId: attachment.contentId,
                content: attachment.content,
                contentLocation: attachment.contentLocation,
            },
        });
    } catch (error) {
        console.log(`Failed to upsert attachment for email ${emailId}: ${error}`);
    }
}

export { syncEmailsToDatabase };