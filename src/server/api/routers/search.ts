import { z } from "zod";
import { createTRPCRouter, privateProcedure } from "../trpc";

export const searchRouter = createTRPCRouter({
    search: privateProcedure
        .input(z.object({
            accountId: z.string(),
            query: z.string(),
        }))
        .mutation(async ({ ctx, input }) => {
            // Search emails by subject, body, or from address
            const emails = await ctx.db.email.findMany({
                where: {
                    thread: {
                        accountId: input.accountId,
                    },
                    OR: [
                        {
                            subject: {
                                contains: input.query,
                                mode: 'insensitive',
                            },
                        },
                        {
                            body: {
                                contains: input.query,
                                mode: 'insensitive',
                            },
                        },
                        {
                            from: {
                                address: {
                                    contains: input.query,
                                    mode: 'insensitive',
                                },
                            },
                        },
                    ],
                },
                include: {
                    thread: {
                        select: {
                            id: true,
                        },
                    },
                    from: {
                        select: {
                            address: true,
                            name: true,
                        },
                    },
                    to: {
                        select: {
                            address: true,
                            name: true,
                        },
                    },
                },
                take: 20,
            });

            return {
                hits: emails.map((email) => ({
                    id: email.id,
                    document: {
                        threadId: email.thread?.id ?? null,
                        title: email.subject ?? '',
                        from: email.from?.address ?? '',
                        to: email.to.map((to) => to.address).filter(Boolean),
                        rawBody: email.body ?? '',
                    },
                })),
            };
        }),
});

