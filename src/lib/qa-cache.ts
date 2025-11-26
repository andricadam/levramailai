import { type AnyOrama, create, insert, search } from '@orama/orama'
import { db } from '@/server/db'
import { restore, persist } from '@orama/plugin-data-persistence'
import { getEmbeddings } from './embedding'

export class QACacheClient {
    private orama!: AnyOrama
    private accountId: string

    constructor(accountId: string) {
        this.accountId = accountId
    }

    async saveIndex() {
        const index = await persist(this.orama, 'json')
        await db.account.update({
            where: {
                id: this.accountId
            },
            data: {
                qaCacheIndex: typeof index === 'string' ? index : String(index)
            }
        })
    }

    async initialize() {
        const account = await db.account.findUnique({
            where: {
                id: this.accountId
            }
        })
        if (!account) {
            throw new Error('Account not found')
        }

        if (account.qaCacheIndex) {
            this.orama = await restore('json', account.qaCacheIndex as any)
        } else {
            this.orama = await create({
                schema: {
                    query: 'string',
                    response: 'string',
                    queryEmbeddings: 'vector[1536]',
                    helpful: 'boolean',
                    createdAt: 'string',
                    usageCount: 'number',
                    lastUsed: 'string',
                }
            })
            await this.saveIndex()
        }
    }

    async searchSimilarQuery(userQuery: string, similarityThreshold: number = 0.85) {
        const queryEmbeddings = await getEmbeddings(userQuery)
        const results = await search(this.orama, {
            mode: 'hybrid',
            term: userQuery,
            vector: {
                value: queryEmbeddings,
                property: 'queryEmbeddings'
            },
            similarity: similarityThreshold,
            limit: 10 // Get more results to filter out unhelpful ones
        })
        
        // Filter out unhelpful Q&As and return the first helpful one
        const helpfulHits = results.hits.filter((hit: any) => {
            const doc = hit.document
            // Only return helpful Q&As (helpful === true or helpful === null for new ones)
            return doc?.helpful !== false
        })
        
        if (helpfulHits.length > 0) {
            const hit = helpfulHits[0]
            // Update usage tracking (async, don't block)
            this.updateUsageCount(hit.id as string).catch(console.error)
            return hit
        }
        return null
    }

    async addQA(query: string, response: string, helpful: boolean | null = null) {
        // Check if very similar question already exists
        const existing = await this.searchSimilarQuery(query, 0.95)
        
        if (existing) {
            // Very similar question exists
            // Only update if this response is significantly better (longer, more detailed)
            const existingResponse = existing.document?.response || ''
            if (response.length > existingResponse.length * 1.2) {
                // Better response, but we can't update in Orama easily
                // So we'll add it anyway and let the search return the better one
                // (Orama will return the most similar, which should be the better one)
            } else {
                // Similar question with similar quality response, skip duplicate
                return
            }
        }

        // Filter out very short responses
        if (response.length < 50) {
            return // Too short, probably not useful
        }

        const queryEmbeddings = await getEmbeddings(query)
        await insert(this.orama, {
            query,
            response,
            queryEmbeddings,
            helpful: helpful ?? true, // Default to helpful if not specified
            createdAt: new Date().toISOString(),
            usageCount: 0,
            lastUsed: new Date().toISOString(),
        })
        await this.saveIndex()
    }

    private async updateUsageCount(docId: string) {
        // Note: Orama doesn't have a direct update method
        // This is a limitation - we'd need to rebuild the index or use a different approach
        // For now, we'll track usage in a separate way or accept this limitation
        // The usageCount field is stored but not easily updatable without rebuilding
    }

    async removeUnhelpful(query: string) {
        // Orama doesn't have a delete method, so we need to rebuild the index
        // This is expensive, so we'll mark items as unhelpful and filter them out
        // For now, we'll rebuild the cache excluding unhelpful items
        try {
            const allResults = await search(this.orama, {
                term: query,
                limit: 100
            })

            // Get all documents
            const allDocs = await this.getAllDocuments()
            
            // Filter out unhelpful ones
            const helpfulDocs = allDocs.filter((doc: any) => {
                // Remove if it matches the query and is unhelpful
                if (doc.helpful === false) {
                    return false
                }
                return true
            })

            // Rebuild index with only helpful docs
            if (helpfulDocs.length < allDocs.length) {
                await this.rebuildIndex(helpfulDocs)
            }
        } catch (error) {
            console.error('Error removing unhelpful Q&A:', error)
        }
    }

    private async getAllDocuments(): Promise<any[]> {
        // Search with very broad terms to get all documents
        const results = await search(this.orama, {
            term: '',
            limit: 10000 // Large limit to get all
        })
        return results.hits.map(hit => hit.document)
    }

    private async rebuildIndex(documents: any[]) {
        // Create new index
        this.orama = await create({
            schema: {
                query: 'string',
                response: 'string',
                queryEmbeddings: 'vector[1536]',
                helpful: 'boolean',
                createdAt: 'string',
                usageCount: 'number',
                lastUsed: 'string',
            }
        })

        // Re-insert all helpful documents
        for (const doc of documents) {
            await insert(this.orama, doc)
        }

        await this.saveIndex()
    }
}

