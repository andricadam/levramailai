import { z } from "zod";
import { createTRPCRouter, privateProcedure } from "../trpc";
import { db } from "@/server/db";

export const authoriseAccess = async (accountId: string, userId: string) => {
    const account = await db.account.findFirst({
        where: {
            id: accountId,
            userId
        }, select: {
            id: true, emailAddress: true, name: true, accessToken: true
        }
    })
    if (!account) throw new Error("Account not found")
    return account
}


export const accountRouter = createTRPCRouter({
    getAccounts: privateProcedure.query(async ({ctx})=>{
        return await ctx.db.account.findMany({
            where: {
                userId: ctx.auth.userId
            },
            select: {
                id: true, emailAddress: true, name: true
            }
        })
    }),
    getMyAccount: privateProcedure
        .input(z.object({
            accountId: z.string(),
        }))
        .query(async ({ ctx, input }) => {
            return await authoriseAccess(input.accountId, ctx.auth.userId);
        }),
    getNumThreads: privateProcedure.input(z.object({
        accountId: z.string(),
        tab: z.string()
    })).query(async ({ctx, input})=>{
        const account = await authoriseAccess(input.accountId, ctx.auth.userId)

        const where: {
            accountId: string;
            inboxStatus?: boolean;
            draftStatus?: boolean;
            sentStatus?: boolean;
        } = {
            accountId: account.id,
        };

        if (input.tab === "inbox") {
            where.inboxStatus = true;
        } else if (input.tab === "drafts") {
            where.draftStatus = true;
        } else if (input.tab === "sent") {
            where.sentStatus = true;
        }

        return await ctx.db.thread.count({
            where
        })
    }),
    getThreads: privateProcedure.input(z.object({
        accountId: z.string(),
        tab: z.string(),
        done: z.boolean()
    })).query(async ({ctx, input})=>{
        const account = await authoriseAccess(input.accountId, ctx.auth.userId)

        const filter: {
            accountId: string;
            inboxStatus?: boolean;
            draftStatus?: boolean;
            sentStatus?: boolean;
            done?: { equals: boolean };
        } = {
            accountId: account.id,
        };
        if (input.tab === "inbox") {
            filter.inboxStatus = true;
        } else if (input.tab === "drafts") {
            filter.draftStatus = true;
        } else if (input.tab === "sent") {
            filter.sentStatus = true;
        }

        filter.done = {
            equals: input.done
        };

        return await ctx.db.thread.findMany({
            where: filter,
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
            }, 
            take: 15,
            orderBy: {
                lastMessageDate: 'desc'
            }
        })
    }),
    getSuggestions: privateProcedure.input(z.object({
        accountId: z.string(),
        query: z.string()
    })).query(async ({ctx, input})=>{
        const account = await authoriseAccess(input.accountId, ctx.auth.userId)
        return await ctx.db.emailAddress.findMany({
            where: {
                accountId: account.id,
            },
            select: {
                address: true,
                name: true,
            }
        })
    }),
    getReplyDetails: privateProcedure.input(z.object({
        accountId: z.string(),
        threadId: z.string()
    })).query(async ({ctx, input})=>{
        const account = await authoriseAccess(input.accountId, ctx.auth.userId)
        const thread = await ctx.db.thread.findFirst({
            where: {
                id: input.threadId,
            },
            include: {
                emails: {
                    orderBy: { sentAt: 'asc' },
                    select: {
                        from: true,
                        to: true,
                        cc: true,
                        bcc: true,
                        sentAt: true,
                        subject: true,
                        internetMessageId: true
                    }
                }
            }
        })
        if (!thread || thread.emails.length === 0) throw new Error("Thread not found")

        const lastExternalEmail = thread.emails.reverse().find(email => email.from.address !== account.emailAddress)
        if (!lastExternalEmail) throw new Error("No external email found")

        return {
            subject: lastExternalEmail.subject,
            to: [lastExternalEmail.from, ...lastExternalEmail.to.filter(to => to.address !== account.emailAddress)],
            cc: lastExternalEmail.cc.filter(cc => cc.address !== account.emailAddress),
            from: { name: account.name, address: account.emailAddress },
            id: lastExternalEmail.internetMessageId
        }
    })
})
