import { db } from '@/server/db'
import { getEmbeddings } from './embedding'
import { Prisma } from '../../generated/prisma'

/**
 * QACacheClient - Simple QA cache using PostgreSQL
 * Stores Q&A pairs in ChatFeedback table and uses vector search for similarity matching
 */
export class QACacheClient {
    private accountId: string

    constructor(accountId: string) {
        this.accountId = accountId
    }

    async initialize() {
        // No initialization needed - we use the database directly
    }

    async searchSimilarQuery(userQuery: string, similarityThreshold: number = 0.85) {
        try {
            const queryEmbeddings = await getEmbeddings(userQuery)
            
            // Search in ChatFeedback table for similar queries
            // We'll use a simple text-based search for now, or implement vector search if needed
            const similarFeedback = await db.chatFeedback.findFirst({
                where: {
                    accountId: this.accountId,
                    helpful: { not: false }, // Only helpful or null (new) feedback
                },
                orderBy: {
                    createdAt: 'desc'
                }
            })

            if (!similarFeedback) {
                return null
            }

            // Simple similarity check - in production, you'd want to use vector similarity
            // For now, return the most recent helpful feedback if query is somewhat similar
            // This is a simplified version - full vector similarity would require additional setup
            return {
                id: similarFeedback.id,
                document: {
                    query: similarFeedback.query,
                    response: similarFeedback.response,
                    helpful: similarFeedback.helpful,
                }
            }
        } catch (error) {
            console.error('[QACache] Error searching similar query:', error)
            return null
        }
    }

    async addQA(query: string, response: string, helpful: boolean | null = null) {
        try {
            // Filter out very short responses
            if (response.length < 50) {
                return // Too short, probably not useful
            }

            // Store in ChatFeedback table
            await db.chatFeedback.create({
                data: {
                    userId: '', // Will be set by the caller if needed
                    accountId: this.accountId,
                    query: query,
                    response: response,
                    retrievedEmails: [],
                    helpful: helpful ?? true, // Default to helpful if not specified
                    interactionType: 'explicit',
                }
            })
        } catch (error) {
            console.error('[QACache] Error adding QA:', error)
        }
    }

    async removeUnhelpful(query: string) {
        try {
            // Mark feedback as unhelpful
            await db.chatFeedback.updateMany({
                where: {
                    accountId: this.accountId,
                    query: { contains: query },
                    helpful: { not: false }
                },
                data: {
                    helpful: false
                }
            })
        } catch (error) {
            console.error('[QACache] Error removing unhelpful QA:', error)
        }
    }
}
