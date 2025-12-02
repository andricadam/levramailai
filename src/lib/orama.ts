import { type AnyOrama, create, insert, search } from '@orama/orama'
import { db } from '@/server/db'
import { restore, persist } from '@orama/plugin-data-persistence'
import { getEmbeddings } from './embedding'


export class OramaClient {
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
                oramaIndex: typeof index === 'string' ? index : String(index)
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

        if (account.oramaIndex) {
            this.orama = await restore('json', account.oramaIndex as any)
            // Check if schema needs migration (for existing indexes)
            // If source field doesn't exist, we'll need to handle it gracefully
            console.log(`[Orama] Restored index from database for account ${this.accountId}`);
        } else {
            this.orama = await create({
                schema: {
                    subject: 'string',
                    body: 'string',
                    rowBody: 'string',
                    from: 'string',
                    to: 'string[]',
                    sentAt: 'string',
                    threadId: 'string',
                    // New fields for file attachments
                    source: 'string', // 'email' | 'file'
                    sourceId: 'string', // emailId or fileId
                    fileName: 'string', // For files
                    embeddings: 'vector[1536]'
                }
            })
            await this.saveIndex()
            console.log(`[Orama] Created new empty index for account ${this.accountId}`);
        }
    }

    async vectorSearch({ 
        term, 
        preferredEmailIds 
    }: { 
        term: string
        preferredEmailIds?: string[]
    }) {
        try {
            const embeddings = await getEmbeddings(term)
            const results = await search(this.orama, {
                mode: 'hybrid',
                term: term,
                vector: {
                    value: embeddings,
                    property: 'embeddings'
                },
                similarity: 0.6, // Lowered from 0.8 to find more relevant emails
                limit: 20 // Get more results to allow for filtering/prioritization
            })
            
            // Note: preferredEmailIds are handled in the API route by fetching emails directly from DB
            // This allows us to include exact email content even if it's not in the top vector results
            // The API route will combine context emails with vector search results
            
            return results
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            // If quota error or embedding error, fallback to keyword search
            if (errorMessage.includes("quota") || errorMessage.includes("exceeded") || errorMessage.includes("billing") || errorMessage.includes("embedding")) {
                console.warn("[QUOTA] Vector search failed due to quota/embedding error, falling back to keyword search");
                // Fallback to keyword-only search
                return await search(this.orama, {
                    term: term,
                    limit: 20
                });
            }
            throw error;
        }
    }

    async search({ term }: { term: string }) {
        return await search(this.orama, {
            term,
        })
    }
    
    async searchBySource({ term, source }: { term: string, source: string }) {
        const embeddings = await getEmbeddings(term)
        const results = await search(this.orama, {
            mode: 'hybrid',
            term: term,
            vector: {
                value: embeddings,
                property: 'embeddings'
            },
            similarity: 0.6, // Lowered from 0.8 to find more relevant emails
            limit: 20
        })
        
        // Filter by source after search (Orama doesn't support where clause in hybrid search)
        return {
            ...results,
            hits: results.hits.filter((hit: any) => hit.document?.source === source)
        }
    }
    async insert(document: any) {
        await insert(this.orama, document)
        // Don't save index after every insert - batch saves instead
    }

    async insertBatch(documents: any[]) {
        console.log(`[Orama] Inserting ${documents.length} documents into index for account ${this.accountId}`);
        for (const document of documents) {
            await insert(this.orama, document)
        }
        // Save index once after batch insert
        await this.saveIndex()
        console.log(`[Orama] Successfully inserted and saved ${documents.length} documents`);
    }

    /**
     * Get approximate count of documents in the index by performing a broad search
     * This is useful for debugging to check if emails are actually indexed
     */
    async getDocumentCount(): Promise<number> {
        try {
            // Perform a very broad search to get all documents
            const results = await search(this.orama, {
                term: '*',
                limit: 10000 // Large limit to get all documents
            });
            return results.hits.length;
        } catch (error) {
            console.error("[Orama] Error getting document count:", error);
            return 0;
        }
    }
}