import { z } from "zod";
import { createTRPCRouter, privateProcedure } from "../trpc";

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
});

