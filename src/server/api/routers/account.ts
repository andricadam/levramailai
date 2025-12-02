import { z } from "zod";
import { createTRPCRouter, privateProcedure } from "../trpc";
import { db, retryDbOperation } from "@/server/db";
import { emailAddressSchema } from "@/types";
import { Account } from "@/lib/acount";
import { syncEmailsToDatabase } from "@/lib/sync-emails";
import { PgVectorClient } from "@/lib/pgvector";
import { FREE_CREDITS_PER_DAY } from "@/constants";

export const authoriseAccess = async (accountId: string, userId: string) => {
    const account = await retryDbOperation(
        async () => {
            return await db.account.findFirst({
                where: {
                    id: accountId,
                    userId
                }, select: {
                    id: true, emailAddress: true, name: true, accessToken: true
                }
            })
        },
        3, // maxRetries
        1000 // baseDelay
    )
    if (!account) throw new Error("Account not found")
    return account
}


export const accountRouter = createTRPCRouter({
    getAccounts: privateProcedure.query(async ({ctx})=>{
        const userId = ctx.auth.userId
        console.log('getAccounts query - userId:', userId)
        
        try {
            const accounts = await ctx.db.account.findMany({
                where: {
                    userId: userId
                },
                select: {
                    id: true, emailAddress: true, name: true
                }
            })
            
            console.log('getAccounts query - found accounts:', accounts.length, accounts)
            
            return accounts
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            console.error('❌ getAccounts query failed:', errorMessage)
            
            // If it's a connection error, provide helpful message
            if (errorMessage.includes("Can't reach database server")) {
                console.error('💡 Database connection issue detected!')
                console.error('   This usually means:')
                console.error('   1. Supabase database is paused (most common on free tier)')
                console.error('   2. Go to https://supabase.com/dashboard and resume your project')
                console.error('   3. Or check your DATABASE_URL in .env file')
            }
            
            throw error
        }
    }),
    getMyAccount: privateProcedure
        .input(z.object({
            accountId: z.string().min(1, "Account ID cannot be empty"),
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
            spamStatus?: boolean;
            junkStatus?: boolean;
        } = {
            accountId: account.id,
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
        return await retryDbOperation(
            async () => {
                return await ctx.db.thread.count({
                    where
                });
            },
            3, // max retries
            1000 // base delay of 1 second
        )
    }),
    getThreads: privateProcedure.input(z.object({
        accountId: z.string(),
        tab: z.string(),
        done: z.boolean()
    })).query(async ({ctx, input})=>{
        const account = await authoriseAccess(input.accountId, ctx.auth.userId)
        const acc = new Account(account.accessToken, account.id)
        acc.syncEmails().catch(console.error)

        const filter: {
            accountId: string;
            inboxStatus?: boolean;
            draftStatus?: boolean;
            sentStatus?: boolean;
            spamStatus?: boolean;
            junkStatus?: boolean;
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
        } else if (input.tab === "spam") {
            filter.spamStatus = true;
        } else if (input.tab === "junk") {
            filter.junkStatus = true;
        }

        filter.done = {
            equals: input.done
        };

        // Use retry logic to handle connection pool timeouts
        return await retryDbOperation(
            async () => {
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
                        priority: true,
                    }
                },
                threadLabels: {
                    include: {
                        label: true,
                    }
                }
            }, 
            take: 15,
            orderBy: {
                lastMessageDate: 'desc'
            }
                })
            },
            3, // maxRetries
            1000 // baseDelay
        )
    }),
    getThread: privateProcedure.input(z.object({
        accountId: z.string(),
        threadId: z.string()
    })).query(async ({ctx, input})=>{
        const account = await authoriseAccess(input.accountId, ctx.auth.userId)
        
        const thread = await ctx.db.thread.findFirst({
            where: {
                id: input.threadId,
                accountId: account.id,
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
                        priority: true,
                    }
                }
            }
        })
        
        return thread
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
                        internetMessageId: true,
                        autoReplyDraft: true,
                        emailLabel: true
                    }
                }
            }
        })
        if (!thread || thread.emails.length === 0) throw new Error("Thread not found")

        const lastExternalEmail = thread.emails.reverse().find(email => email.from.address !== account.emailAddress)
        if (!lastExternalEmail) throw new Error("No external email found")

        // Find the most recent inbox email with a draft (if any)
        const emailsWithDrafts = thread.emails
            .filter(email => email.emailLabel === 'inbox' && email.autoReplyDraft)
            .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
        
        const autoReplyDraft = emailsWithDrafts.length > 0 ? emailsWithDrafts[0].autoReplyDraft : null;

        return {
            subject: lastExternalEmail.subject,
            to: [lastExternalEmail.from, ...lastExternalEmail.to.filter(to => to.address !== account.emailAddress)],
            cc: lastExternalEmail.cc.filter(cc => cc.address !== account.emailAddress),
            from: { name: account.name, address: account.emailAddress },
            id: lastExternalEmail.internetMessageId,
            autoReplyDraft: autoReplyDraft
        }
    }),
    sendEmail: privateProcedure.input(z.object({
        accountId: z.string(),
        body: z.string(),
        subject: z.string(),
        from: emailAddressSchema,
        cc: z.array(emailAddressSchema).optional(),
        bcc: z.array(emailAddressSchema).optional(),
        to: z.array(emailAddressSchema),

        replyTo: z.array(emailAddressSchema).optional(),
        inReplyTo: z.string().optional(),
        threadId: z.string().optional(),
        references: z.array(z.string()).optional(),
        instantReplyFeedbackId: z.string().optional(), // Link to generated reply
    })).mutation(async ({ ctx, input }) => {
        const account = await authoriseAccess(input.accountId, ctx.auth.userId)
        const acc = new Account(account.accessToken as string, account.id)
        await acc.sendEmail({
            body: input.body,
            subject: input.subject,
            from: input.from,
            to: input.to,
            cc: input.cc,
            bcc: input.bcc,
            replyTo: input.replyTo,
            inReplyTo: input.inReplyTo,
            threadId: input.threadId,
            references: input.references
        })

        // FEEDBACK LOOP: Compare generated vs final and store for fine-tuning
        if (input.instantReplyFeedbackId && ctx.auth.userId) {
            try {
                const { calculateSimilarity } = await import('@/lib/text-comparison');
                const { logDraftFinalPair, triggerFineTuning } = await import('@/lib/tone-of-voice-client');

                const feedback = await ctx.db.instantReplyFeedback.findUnique({
                    where: { id: input.instantReplyFeedbackId }
                });

                if (feedback && feedback.userId === ctx.auth.userId) {
                    const generated = feedback.generatedReply.trim();
                    const final = input.body.trim();
                    const wasEdited = generated !== final;
                    const similarity = calculateSimilarity(generated, final);

                    // Update feedback record
                    await ctx.db.instantReplyFeedback.update({
                        where: { id: input.instantReplyFeedbackId },
                        data: {
                            finalSentReply: final,
                            wasEdited,
                            editSimilarity: similarity,
                        }
                    });

                    // LOG FOR FINE-TUNING: Send to Python service
                    if (wasEdited || similarity < 0.95) {
                        // Only log if user made meaningful changes
                        await logDraftFinalPair({
                            draft: generated,
                            final: final,
                            userId: ctx.auth.userId,
                            accountId: input.accountId,
                        });

                        // Trigger fine-tuning check (async, don't block)
                        triggerFineTuning(ctx.auth.userId, input.accountId).catch(console.error);
                    }
                }
            } catch (error) {
                console.error('Failed to update instant reply feedback:', error);
                // Don't fail the email send if feedback tracking fails
            }
        }
    }),
    deleteAccount: privateProcedure.input(z.object({
        accountId: z.string(),
    })).mutation(async ({ ctx, input }) => {
        // Verify the account belongs to the user
        const account = await authoriseAccess(input.accountId, ctx.auth.userId)
        
        // Get all thread IDs for this account
        const threads = await ctx.db.thread.findMany({
            where: { accountId: account.id },
            select: { id: true }
        });
        const threadIds = threads.map(t => t.id);

        // Delete in correct order due to foreign key constraints
        if (threadIds.length > 0) {
            // 1. Delete email attachments
            await ctx.db.emailAttachment.deleteMany({
                where: {
                    Email: {
                        threadId: { in: threadIds }
                    }
                }
            });

            // 2. Delete emails
            await ctx.db.email.deleteMany({
                where: {
                    threadId: { in: threadIds }
                }
            });
        }

        // 3. Delete threads
        await ctx.db.thread.deleteMany({
            where: {
                accountId: account.id
            }
        });

        // 4. Delete email addresses
        await ctx.db.emailAddress.deleteMany({
            where: {
                accountId: account.id
            }
        });

        // 5. Delete the account
        await ctx.db.account.delete({
            where: { id: account.id }
        });

        return { success: true };
    }),
    syncAccount: privateProcedure.input(z.object({
        accountId: z.string(),
    })).mutation(async ({ ctx, input }) => {
        // Verify the account belongs to the user
        const account = await authoriseAccess(input.accountId, ctx.auth.userId)
        
        console.log(`Starting manual sync for account ${account.id} (provider: ${account.provider})...`);
        
        try {
            // Create Account instance and perform initial sync
            const acc = new Account(account.accessToken as string, account.id);
            const response = await acc.performInitialSync();
            
            // For Gmail/Microsoft, performInitialSync already syncs emails to database
            // For Aurinko, we need to sync the emails ourselves
            if (account.provider === 'google' || account.provider === 'microsoft') {
                if (!response) {
                    throw new Error(`Failed to perform initial sync for ${account.provider} account`);
                }
                
                // Count emails synced by checking database
                const emailCount = await ctx.db.email.count({
                    where: {
                        thread: {
                            accountId: account.id
                        }
                    }
                });
                
                console.log(`Successfully synced ${account.provider} account ${account.id}. Total emails in database: ${emailCount}`);
                
                return { 
                    success: true, 
                    emailsSynced: emailCount,
                    message: `Sync completed. ${emailCount} emails available.`
                };
            } else {
                // Aurinko provider - original logic
                if (!response) {
                    throw new Error("Failed to perform initial sync - no response from Aurinko");
                }
                
                const { emails, deltaToken } = response;
                
                console.log(`Fetched ${emails.length} emails from Aurinko`);
                
                // Sync emails to database
                await syncEmailsToDatabase(account.id, emails);
                
                // Update the delta token for future incremental syncs
                await ctx.db.account.update({
                    where: { id: account.id },
                    data: { nextDeltaToken: deltaToken }
                });
                
                console.log(`Successfully synced ${emails.length} emails for account ${account.id}`);
                
                return { 
                    success: true, 
                    emailsSynced: emails.length,
                    message: `Successfully synced ${emails.length} emails`
                };
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            console.error('Error syncing account:', errorMessage);
            throw new Error(`Failed to sync account: ${errorMessage}`);
        }
    }),
    searchEmails: privateProcedure.input(z.object({
        accountId: z.string(),
        query: z.string()
    })).mutation(async ({ctx, input})=>{
        const account = await authoriseAccess(input.accountId, ctx.auth.userId)
        const vectorClient = new PgVectorClient(account.id)
        await vectorClient.initialize()
        const results = await vectorClient.search({ term: input.query })
        return results
    }),
    searchThreadsForContext: privateProcedure.input(z.object({
        accountId: z.string(),
        search: z.string().optional(),
        limit: z.number().min(1).max(50).default(20)
    })).query(async ({ctx, input})=>{
        const account = await authoriseAccess(input.accountId, ctx.auth.userId)
        
        // Build search filter
        const where: any = {
            accountId: account.id,
        }

        // Add search filter if query provided
        if (input.search && input.search.trim().length > 0) {
            const searchTerm = input.search.trim()
            where.OR = [
                {
                    subject: {
                        contains: searchTerm,
                        mode: 'insensitive'
                    }
                },
                {
                    emails: {
                        some: {
                            OR: [
                                {
                                    subject: {
                                        contains: searchTerm,
                                        mode: 'insensitive'
                                    }
                                },
                                {
                                    from: {
                                        name: {
                                            contains: searchTerm,
                                            mode: 'insensitive'
                                        }
                                    }
                                },
                                {
                                    from: {
                                        address: {
                                            contains: searchTerm,
                                            mode: 'insensitive'
                                        }
                                    }
                                }
                            ]
                        }
                    }
                }
            ]
        }

        return await ctx.db.thread.findMany({
            where,
            include: {
                emails: {
                    orderBy: {
                        sentAt: 'desc'
                    },
                    take: 1, // Only get the latest email
                    select: {
                        id: true,
                        subject: true,
                        bodySnippet: true,
                        sentAt: true,
                        hasAttachments: true, // Include attachment flag
                        from: {
                            select: {
                                name: true,
                                address: true
                            }
                        }
                    }
                }
            },
            take: input.limit,
            orderBy: {
                lastMessageDate: 'desc'
            }
        })
    }),
    getChatbotInteractions: privateProcedure.input(z.object({
        accountId: z.string(),
    })).query(async ({ctx, input})=>{
        const account = await authoriseAccess(input.accountId, ctx.auth.userId)
        const today = new Date().toDateString()
        const chatbotInteraction = await db.chatbotInteraction.findUnique({
            where: {
                day_userId: {
                    day: today,
                    userId: ctx.auth.userId
                }
            }
        })
        const remainingCredits = FREE_CREDITS_PER_DAY - (chatbotInteraction?.count ?? 0)
        return { remainingCredits }
    })
})
