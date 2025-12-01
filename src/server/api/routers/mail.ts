import { z } from "zod";
import { createTRPCRouter, privateProcedure } from "../trpc";
import { authoriseAccess } from "./account";
import { retryDbOperation } from "@/server/db";
import { Account } from "@/lib/acount";

export const mailRouter = createTRPCRouter({
    getNumThreads: privateProcedure
        .input(z.object({
            accountId: z.string(),
            tab: z.enum(["inbox", "drafts", "sent", "spam", "junk"]),
        }))
        .query(async ({ ctx, input }) => {
            const where: {
                accountId: string;
                inboxStatus?: boolean;
                draftStatus?: boolean;
                sentStatus?: boolean;
                spamStatus?: boolean;
                junkStatus?: boolean;
            } = {
                accountId: input.accountId,
            };

            if (input.tab === "inbox") {
                where.inboxStatus = true;
            } else if (input.tab === "drafts") {
                where.draftStatus = true;
            } else if (input.tab === "sent") {
                where.sentStatus = true;
            } else if (input.tab === "spam") {
                where.spamStatus = true;
            } else if (input.tab === "junk") {
                where.junkStatus = true;
            }

            // Use retry logic to handle connection pool timeouts
            const count = await retryDbOperation(
                async () => {
                    return await ctx.db.thread.count({
                        where,
                    });
                },
                3, // max retries
                1000 // base delay of 1 second
            );

            return count;
        }),
    getChatbotInteraction: privateProcedure
        .query(async ({ ctx }) => {
            // TODO: Implement actual credit tracking logic
            // For now, return a placeholder with remaining credits
            // In a real implementation, you would track chatbot interactions
            // and calculate remaining credits based on subscription status
            const FREE_CREDITS_PER_DAY = 10;
            
            return {
                remainingCredits: FREE_CREDITS_PER_DAY,
            };
        }),
    getThreadById: privateProcedure
        .input(z.object({
            accountId: z.string(),
            threadId: z.string(),
        }))
        .query(async ({ ctx, input }) => {
            return await ctx.db.thread.findFirst({
                where: {
                    id: input.threadId,
                    accountId: input.accountId,
                },
                include: {
                    emails: {
                        orderBy: {
                            sentAt: 'asc'
                        },
                        select: {
                            from: true,
                            body: true,
                            bodySnippet: true,
                            emailLabel: true,
                            subject: true,
                            sysLabels: true,
                            id: true,
                            sentAt: true,
                        }
                    },
                    threadLabels: {
                        include: {
                            label: true,
                        }
                    }
                }
            });
        }),
    sendEmail: privateProcedure
        .input(z.object({
            accountId: z.string(),
            threadId: z.string().optional(),
            body: z.string(),
            subject: z.string(),
            from: z.object({
                name: z.string(),
                address: z.string(),
            }),
            to: z.array(z.object({
                name: z.string(),
                address: z.string(),
            })),
            cc: z.array(z.object({
                name: z.string(),
                address: z.string(),
            })),
            replyTo: z.object({
                name: z.string(),
                address: z.string(),
            }),
            inReplyTo: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            await authoriseAccess(input.accountId, ctx.auth.userId);
            // TODO: Implement email sending via Aurinko API
            throw new Error("sendEmail not yet implemented");
        }),
    getReplyDetails: privateProcedure
        .input(z.object({
            accountId: z.string(),
            threadId: z.string(),
            replyType: z.enum(["reply", "replyAll", "forward"]),
        }))
        .query(async ({ ctx, input }) => {
            await authoriseAccess(input.accountId, ctx.auth.userId);
            // TODO: Implement getReplyDetails
            throw new Error("getReplyDetails not yet implemented");
        }),
    getEmailSuggestions: privateProcedure
        .input(z.object({
            accountId: z.string(),
            query: z.string(),
        }))
        .query(async ({ ctx, input }) => {
            await authoriseAccess(input.accountId, ctx.auth.userId);
            // TODO: Implement email suggestions
            return [] as { address: string }[];
        }),
    archiveThread: privateProcedure
        .input(z.object({
            accountId: z.string(),
            threadId: z.string(),
        }))
        .mutation(async ({ ctx, input }) => {
            const account = await authoriseAccess(input.accountId, ctx.auth.userId);
            
            // Verify thread exists and belongs to account
            const thread = await ctx.db.thread.findFirst({
                where: {
                    id: input.threadId,
                    accountId: input.accountId,
                },
            });

            if (!thread) {
                throw new Error("Thread not found");
            }

            // Call API to archive thread
            const acc = new Account(account.accessToken as string, account.id);
            await acc.archiveThread(thread.id);

            // Update database: remove from inbox
            await ctx.db.thread.update({
                where: { id: thread.id },
                data: { inboxStatus: false },
            });

            return { success: true };
        }),
    deleteThread: privateProcedure
        .input(z.object({
            accountId: z.string(),
            threadId: z.string(),
        }))
        .mutation(async ({ ctx, input }) => {
            const account = await authoriseAccess(input.accountId, ctx.auth.userId);
            
            // Verify thread exists and belongs to account
            const thread = await ctx.db.thread.findFirst({
                where: {
                    id: input.threadId,
                    accountId: input.accountId,
                },
            });

            if (!thread) {
                throw new Error("Thread not found");
            }

            // Call API to delete thread (move to junk/trash)
            const acc = new Account(account.accessToken as string, account.id);
            await acc.deleteThread(thread.id);

            // Update database: move to junk, remove from inbox
            await ctx.db.thread.update({
                where: { id: thread.id },
                data: { 
                    junkStatus: true,
                    inboxStatus: false,
                },
            });

            return { success: true };
        }),
    markAsUnread: privateProcedure
        .input(z.object({
            accountId: z.string(),
            threadId: z.string(),
        }))
        .mutation(async ({ ctx, input }) => {
            const account = await authoriseAccess(input.accountId, ctx.auth.userId);
            
            // Verify thread exists and belongs to account
            const thread = await ctx.db.thread.findFirst({
                where: {
                    id: input.threadId,
                    accountId: input.accountId,
                },
                include: {
                    emails: {
                        select: { id: true, sysLabels: true },
                    },
                },
            });

            if (!thread) {
                throw new Error("Thread not found");
            }

            // Call API to mark thread as unread
            const acc = new Account(account.accessToken as string, account.id);
            await acc.markAsUnread(thread.id);

            // Update database: add 'unread' to all emails' sysLabels
            await Promise.all(
                thread.emails.map(email => {
                    const currentLabels = email.sysLabels || [];
                    const updatedLabels = currentLabels.includes('unread') 
                        ? currentLabels 
                        : [...currentLabels, 'unread'];
                    
                    return ctx.db.email.update({
                        where: { id: email.id },
                        data: { sysLabels: updatedLabels },
                    });
                })
            );

            return { success: true };
        }),
});

