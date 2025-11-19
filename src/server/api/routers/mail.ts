import { z } from "zod";
import { createTRPCRouter, privateProcedure } from "../trpc";
import { authoriseAccess } from "./account";

export const mailRouter = createTRPCRouter({
    getNumThreads: privateProcedure
        .input(z.object({
            accountId: z.string(),
            tab: z.enum(["inbox", "drafts", "sent"]),
        }))
        .query(async ({ ctx, input }) => {
            const where: {
                accountId: string;
                inboxStatus?: boolean;
                draftStatus?: boolean;
                sentStatus?: boolean;
            } = {
                accountId: input.accountId,
            };

            if (input.tab === "inbox") {
                where.inboxStatus = true;
            } else if (input.tab === "drafts") {
                where.draftStatus = true;
            } else if (input.tab === "sent") {
                where.sentStatus = true;
            }

            const count = await ctx.db.thread.count({
                where,
            });

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
});

