import { z } from "zod";
import { createTRPCRouter, privateProcedure } from "../trpc";

export const labelsRouter = createTRPCRouter({
    // Get all labels for the current user
    getLabels: privateProcedure.query(async ({ ctx }) => {
        return await ctx.db.userLabel.findMany({
            where: {
                userId: ctx.auth.userId,
            },
            orderBy: {
                createdAt: 'asc'
            }
        });
    }),

    // Create a new label
    createLabel: privateProcedure
        .input(z.object({
            name: z.string().min(1, "Label name is required"),
            description: z.string().optional(),
            color: z.string().default("#6b7280"),
        }))
        .mutation(async ({ ctx, input }) => {
            return await ctx.db.userLabel.create({
                data: {
                    userId: ctx.auth.userId,
                    name: input.name,
                    description: input.description,
                    color: input.color,
                }
            });
        }),

    // Update an existing label
    updateLabel: privateProcedure
        .input(z.object({
            id: z.string(),
            name: z.string().min(1).optional(),
            description: z.string().optional(),
            color: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            const { id, ...updateData } = input;
            
            // Verify the label belongs to the user
            const label = await ctx.db.userLabel.findFirst({
                where: {
                    id,
                    userId: ctx.auth.userId,
                }
            });

            if (!label) {
                throw new Error("Label not found");
            }

            return await ctx.db.userLabel.update({
                where: { id },
                data: updateData,
            });
        }),

    // Delete a label
    deleteLabel: privateProcedure
        .input(z.object({
            id: z.string(),
        }))
        .mutation(async ({ ctx, input }) => {
            // Verify the label belongs to the user
            const label = await ctx.db.userLabel.findFirst({
                where: {
                    id: input.id,
                    userId: ctx.auth.userId,
                }
            });

            if (!label) {
                throw new Error("Label not found");
            }

            // Delete the label (cascade will handle thread labels)
            return await ctx.db.userLabel.delete({
                where: { id: input.id },
            });
        }),

    // Assign a label to a thread
    assignLabelToThread: privateProcedure
        .input(z.object({
            threadId: z.string(),
            labelId: z.string(),
        }))
        .mutation(async ({ ctx, input }) => {
            // Verify the label belongs to the user
            const label = await ctx.db.userLabel.findFirst({
                where: {
                    id: input.labelId,
                    userId: ctx.auth.userId,
                }
            });

            if (!label) {
                throw new Error("Label not found");
            }

            // Verify the thread exists and belongs to the user
            const thread = await ctx.db.thread.findFirst({
                where: {
                    id: input.threadId,
                    account: {
                        userId: ctx.auth.userId,
                    }
                }
            });

            if (!thread) {
                throw new Error("Thread not found");
            }

            // Create or update the association (upsert to handle duplicates)
            return await ctx.db.threadLabel.upsert({
                where: {
                    threadId_labelId: {
                        threadId: input.threadId,
                        labelId: input.labelId,
                    }
                },
                create: {
                    threadId: input.threadId,
                    labelId: input.labelId,
                },
                update: {},
            });
        }),

    // Remove a label from a thread
    removeLabelFromThread: privateProcedure
        .input(z.object({
            threadId: z.string(),
            labelId: z.string(),
        }))
        .mutation(async ({ ctx, input }) => {
            // Verify the label belongs to the user
            const label = await ctx.db.userLabel.findFirst({
                where: {
                    id: input.labelId,
                    userId: ctx.auth.userId,
                }
            });

            if (!label) {
                throw new Error("Label not found");
            }

            return await ctx.db.threadLabel.deleteMany({
                where: {
                    threadId: input.threadId,
                    labelId: input.labelId,
                }
            });
        }),

    // Get labels for a specific thread
    getThreadLabels: privateProcedure
        .input(z.object({
            threadId: z.string(),
        }))
        .query(async ({ ctx, input }) => {
            // Verify the thread belongs to the user
            const thread = await ctx.db.thread.findFirst({
                where: {
                    id: input.threadId,
                    account: {
                        userId: ctx.auth.userId,
                    }
                }
            });

            if (!thread) {
                throw new Error("Thread not found");
            }

            return await ctx.db.threadLabel.findMany({
                where: {
                    threadId: input.threadId,
                    label: {
                        userId: ctx.auth.userId,
                    }
                },
                include: {
                    label: true,
                }
            });
        }),
});

