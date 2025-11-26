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
                    embeddings: 'vector[1536]'
                }
            })
            await this.saveIndex()
        }
    }

    async vectorSearch({ 
        term, 
        preferredEmailIds 
    }: { 
        term: string
        preferredEmailIds?: string[]
    }) {
        const embeddings = await getEmbeddings(term)
        const results = await search(this.orama, {
            mode: 'hybrid',
            term: term,
            vector: {
                value: embeddings,
                property: 'embeddings'
            },
            similarity: 0.8,
            limit: 20 // Get more results to allow for filtering/prioritization
        })
        
        // Note: preferredEmailIds are handled in the API route by fetching emails directly from DB
        // This allows us to include exact email content even if it's not in the top vector results
        // The API route will combine context emails with vector search results
        
        return results
    }

    async search({ term }: { term: string }) {
        return await search(this.orama, {
            term,
        })
    }
    async insert(document: any) {
        await insert(this.orama, document)
        await this.saveIndex()
    }
}