import { db } from '@/server/db'
import { getEmbeddings } from './embedding'
import { Prisma } from '../../generated/prisma'

/**
 * PgVector Client - Replaces OramaClient for vector search using PostgreSQL pgvector extension
 */
export class PgVectorClient {
    private accountId: string

    constructor(accountId: string) {
        this.accountId = accountId
    }

    /**
     * Initialize - no-op for pgvector (data is stored directly in database)
     */
    async initialize() {
        // No initialization needed for pgvector
        // Data is stored directly in PostgreSQL
        console.log(`[PgVector] Initialized for account ${this.accountId}`)
    }

    /**
     * Vector search using pgvector cosine similarity
     * Returns results in a format compatible with OramaClient
     */
    async vectorSearch({ 
        term, 
        preferredEmailIds,
        limit = 20,
        similarityThreshold = 0.6
    }: { 
        term: string
        preferredEmailIds?: string[]
        limit?: number
        similarityThreshold?: number
    }) {
        try {
            // Get embeddings for the search term
            const queryEmbeddings = await getEmbeddings(term)
            
            // Convert to PostgreSQL vector format
            const vectorString = `[${queryEmbeddings.join(',')}]`
            
            // Build the query
            // We use cosine distance (1 - cosine similarity)
            // Lower distance = higher similarity
            const account = await db.account.findUnique({
                where: { id: this.accountId },
                select: { id: true }
            })
            
            if (!account) {
                throw new Error('Account not found')
            }

            // Get account's threads to filter emails
            const threads = await db.thread.findMany({
                where: { accountId: this.accountId },
                select: { id: true }
            })
            const threadIds = threads.map(t => t.id)

            if (threadIds.length === 0) {
                return { hits: [] }
            }

            // Try pgvector first, fallback to JavaScript cosine similarity if extension not available
            let results: Array<{
                id: string
                threadId: string
                subject: string
                body: string | null
                bodySnippet: string | null
                sentAt: Date
                fromId: string
                similarity: number
            }> = []

            try {
                // Attempt to use pgvector extension
                const vectorStr = `[${queryEmbeddings.join(',')}]`
                const threadIdsStr = threadIds.map(id => `'${id.replace(/'/g, "''")}'`).join(',')
                
                results = await db.$queryRaw<Array<{
                    id: string
                    threadId: string
                    subject: string
                    body: string | null
                    bodySnippet: string | null
                    sentAt: Date
                    fromId: string
                    similarity: number
                }>>(Prisma.raw(`
                    SELECT 
                        e.id,
                        e."threadId",
                        e.subject,
                        e.body,
                        e."bodySnippet",
                        e."sentAt",
                        e."fromId",
                        1 - (e.embeddings::vector <=> '${vectorStr.replace(/'/g, "''")}'::vector) as similarity
                    FROM "Email" e
                    WHERE e."threadId" = ANY(ARRAY[${threadIdsStr}]::text[])
                        AND e.embeddings IS NOT NULL
                        AND array_length(e.embeddings, 1) = 1536
                    ORDER BY e.embeddings::vector <=> '${vectorStr.replace(/'/g, "''")}'::vector
                    LIMIT ${limit * 2}
                `))
            } catch (error) {
                // Fallback: Use JavaScript cosine similarity if pgvector extension not available
                console.warn('[PgVector] Extension not available, using JavaScript cosine similarity fallback')
                
                const emails = await db.email.findMany({
                    where: {
                        threadId: { in: threadIds },
                        // Filter for non-empty embeddings arrays
                        NOT: { embeddings: { isEmpty: true } }
                    },
                    select: {
                        id: true,
                        threadId: true,
                        subject: true,
                        body: true,
                        bodySnippet: true,
                        sentAt: true,
                        fromId: true,
                        embeddings: true
                    },
                    take: limit * 5 // Get more to filter
                })

                // Calculate cosine similarity in JavaScript
                const calculateCosineSimilarity = (a: number[], b: number[]): number => {
                    if (!a || !b || a.length !== b.length || a.length === 0) return 0
                    let dotProduct = 0
                    let normA = 0
                    let normB = 0
                    for (let i = 0; i < a.length; i++) {
                        const aVal = a[i] ?? 0
                        const bVal = b[i] ?? 0
                        dotProduct += aVal * bVal
                        normA += aVal * aVal
                        normB += bVal * bVal
                    }
                    const denominator = Math.sqrt(normA) * Math.sqrt(normB)
                    return denominator > 0 ? dotProduct / denominator : 0
                }

                results = emails
                    .filter(e => e.embeddings && Array.isArray(e.embeddings) && e.embeddings.length === 1536)
                    .map(e => {
                        const embeddings = (e.embeddings as number[]) || []
                        return {
                            id: e.id,
                            threadId: e.threadId,
                            subject: e.subject || '',
                            body: e.body || null,
                            bodySnippet: e.bodySnippet || null,
                            sentAt: e.sentAt,
                            fromId: e.fromId,
                            similarity: calculateCosineSimilarity(queryEmbeddings, embeddings)
                        }
                    })
                    .sort((a, b) => b.similarity - a.similarity)
                    .slice(0, limit * 2)
            }

            // Filter by similarity threshold and limit
            const filteredResults = results
                .filter(r => r.similarity >= similarityThreshold)
                .slice(0, limit)

            // If preferredEmailIds provided, prioritize them
            let finalResults = filteredResults
            if (preferredEmailIds && preferredEmailIds.length > 0) {
                const preferred = filteredResults.filter(r => 
                    preferredEmailIds.includes(r.id) || preferredEmailIds.includes(r.threadId)
                )
                const others = filteredResults.filter(r => 
                    !preferredEmailIds.includes(r.id) && !preferredEmailIds.includes(r.threadId)
                )
                finalResults = [...preferred, ...others].slice(0, limit)
            }

            // Fetch full email data with relations
            const emailIds = finalResults.map(r => r.id)
            const emails = await db.email.findMany({
                where: { 
                    id: { in: emailIds },
                    thread: { accountId: this.accountId }
                },
                include: {
                    from: true,
                    to: true,
                    cc: true,
                    thread: {
                        select: {
                            id: true,
                            subject: true,
                            accountId: true
                        }
                    }
                }
            })

            // Map to Orama-compatible format
            const hits = finalResults.map((result, index) => {
                const email = emails.find(e => e.id === result.id)
                if (!email) return null

                return {
                    id: email.id,
                    score: result.similarity,
                    document: {
                        subject: email.subject,
                        body: email.body || email.bodySnippet || '',
                        rowBody: email.body || '',
                        from: email.from.address,
                        to: email.to.map(ea => ea.address),
                        sentAt: email.sentAt.toISOString(),
                        threadId: email.threadId,
                        source: 'email',
                        sourceId: email.id,
                        embeddings: email.embeddings || []
                    }
                }
            }).filter(Boolean)

            return {
                hits: hits as any[],
                count: hits.length
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            // If quota error or embedding error, fallback to keyword search
            if (errorMessage.includes("quota") || errorMessage.includes("exceeded") || errorMessage.includes("billing") || errorMessage.includes("embedding")) {
                console.warn("[QUOTA] Vector search failed due to quota/embedding error, falling back to keyword search");
                return await this.search({ term, limit });
            }
            throw error;
        }
    }

    /**
     * Keyword search using PostgreSQL full-text search
     * Fallback when embeddings are not available
     */
    async search({ term, limit = 20 }: { term: string, limit?: number }) {
        const account = await db.account.findUnique({
            where: { id: this.accountId },
            select: { id: true }
        })
        
        if (!account) {
            throw new Error('Account not found')
        }

        // Get account's threads
        const threads = await db.thread.findMany({
            where: { accountId: this.accountId },
            select: { id: true }
        })
        const threadIds = threads.map(t => t.id)

        if (threadIds.length === 0) {
            return { hits: [] }
        }

        // Keyword search using PostgreSQL ILIKE
        const emails = await db.email.findMany({
            where: {
                threadId: { in: threadIds },
                OR: [
                    { subject: { contains: term, mode: 'insensitive' } },
                    { body: { contains: term, mode: 'insensitive' } },
                    { bodySnippet: { contains: term, mode: 'insensitive' } }
                ]
            },
            include: {
                from: true,
                to: true,
                cc: true,
                thread: {
                    select: {
                        id: true,
                        subject: true,
                        accountId: true
                    }
                }
            },
            take: limit,
            orderBy: { sentAt: 'desc' }
        })

        // Map to Orama-compatible format
        const hits = emails.map(email => ({
            id: email.id,
            score: 0.5, // Default score for keyword search
            document: {
                subject: email.subject,
                body: email.body || email.bodySnippet || '',
                rowBody: email.body || '',
                from: email.from.address,
                to: email.to.map(ea => ea.address),
                sentAt: email.sentAt.toISOString(),
                threadId: email.threadId,
                source: 'email',
                sourceId: email.id,
                embeddings: email.embeddings || []
            }
        }))

        return {
            hits,
            count: hits.length
        }
    }

    /**
     * Search ChatAttachments (uploaded documents) using vector search
     */
    async searchChatAttachments(
        term: string, 
        queryEmbeddings?: number[],
        limit: number = 10,
        similarityThreshold: number = 0.6
    ) {
        try {
            if (!queryEmbeddings) {
                queryEmbeddings = await getEmbeddings(term)
            }

            const account = await db.account.findUnique({
                where: { id: this.accountId },
                select: { id: true }
            })
            
            if (!account) {
                throw new Error('Account not found')
            }

            // Try pgvector first, fallback to JavaScript if not available
            let results: Array<{
                id: string
                fileName: string
                extractedText: string
                similarity: number
            }> = []

            try {
                const vectorStr = `[${queryEmbeddings.join(',')}]`
                
                results = await db.$queryRaw<Array<{
                    id: string
                    fileName: string
                    extractedText: string
                    similarity: number
                }>>(Prisma.raw(`
                    SELECT 
                        id,
                        "fileName",
                        "extractedText",
                        1 - ("textEmbeddings"::vector <=> '${vectorStr.replace(/'/g, "''")}'::vector) as similarity
                    FROM "ChatAttachment"
                    WHERE "accountId" = '${this.accountId.replace(/'/g, "''")}'
                        AND "textEmbeddings" IS NOT NULL
                        AND array_length("textEmbeddings", 1) = 1536
                    ORDER BY "textEmbeddings"::vector <=> '${vectorStr.replace(/'/g, "''")}'::vector
                    LIMIT ${limit * 2}
                `))
            } catch (error) {
                // Fallback: JavaScript cosine similarity
                console.warn('[PgVector] ChatAttachment search: Extension not available, using JavaScript fallback')
                
                const attachments = await db.chatAttachment.findMany({
                    where: {
                        accountId: this.accountId,
                        NOT: { textEmbeddings: { isEmpty: true } }
                    },
                    select: {
                        id: true,
                        fileName: true,
                        extractedText: true,
                        textEmbeddings: true
                    },
                    take: limit * 5
                })

                const calculateCosineSimilarity = (a: number[], b: number[]): number => {
                    if (!a || !b || a.length !== b.length || a.length === 0) return 0
                    let dotProduct = 0
                    let normA = 0
                    let normB = 0
                    for (let i = 0; i < a.length; i++) {
                        const aVal = a[i] ?? 0
                        const bVal = b[i] ?? 0
                        dotProduct += aVal * bVal
                        normA += aVal * aVal
                        normB += bVal * bVal
                    }
                    const denominator = Math.sqrt(normA) * Math.sqrt(normB)
                    return denominator > 0 ? dotProduct / denominator : 0
                }

                results = attachments
                    .filter(a => a.textEmbeddings && Array.isArray(a.textEmbeddings) && a.textEmbeddings.length === 1536)
                    .map(a => {
                        const embeddings = (a.textEmbeddings as number[]) || []
                        return {
                            id: a.id,
                            fileName: a.fileName,
                            extractedText: a.extractedText,
                            similarity: calculateCosineSimilarity(queryEmbeddings!, embeddings)
                        }
                    })
                    .sort((a, b) => b.similarity - a.similarity)
                    .slice(0, limit * 2)
            }

            const filteredResults = results
                .filter(r => r.similarity >= similarityThreshold)
                .slice(0, limit)

            const hits = filteredResults.map(result => ({
                id: result.id,
                score: result.similarity,
                document: {
                    fileName: result.fileName,
                    extractedText: result.extractedText,
                    source: 'file',
                    sourceId: result.id,
                    embeddings: []
                }
            }))

            return hits
        } catch (error) {
            console.error('Error in searchChatAttachments:', error)
            return []
        }
    }

    /**
     * Search SyncedItems (integrations: SharePoint, Google Drive, etc.) using vector search
     */
    async searchSyncedItems(
        term: string,
        queryEmbeddings?: number[],
        limit: number = 10,
        similarityThreshold: number = 0.6
    ) {
        try {
            if (!queryEmbeddings) {
                queryEmbeddings = await getEmbeddings(term)
            }

            const account = await db.account.findUnique({
                where: { id: this.accountId },
                select: { id: true }
            })
            
            if (!account) {
                throw new Error('Account not found')
            }

            // Get all app connections for this account
            const connections = await db.appConnection.findMany({
                where: {
                    OR: [
                        { accountId: this.accountId },
                        { userId: account.id } // Also check user-level connections
                    ]
                },
                select: { id: true }
            })

            const connectionIds = connections.map(c => c.id)

            if (connectionIds.length === 0) {
                return []
            }

            let results: Array<{
                id: string
                title: string
                content: string
                itemType: string
                url: string | null
                similarity: number
            }> = []

            try {
                const vectorStr = `[${queryEmbeddings.join(',')}]`
                const connectionIdsStr = connectionIds.map(id => `'${id.replace(/'/g, "''")}'`).join(',')
                
                results = await db.$queryRaw<Array<{
                    id: string
                    title: string
                    content: string
                    itemType: string
                    url: string | null
                    similarity: number
                }>>(Prisma.raw(`
                    SELECT 
                        id,
                        title,
                        content,
                        "itemType",
                        url,
                        1 - (embeddings::vector <=> '${vectorStr.replace(/'/g, "''")}'::vector) as similarity
                    FROM "SyncedItem"
                    WHERE "connectionId" = ANY(ARRAY[${connectionIdsStr}]::text[])
                        AND embeddings IS NOT NULL
                        AND array_length(embeddings, 1) = 1536
                    ORDER BY embeddings::vector <=> '${vectorStr.replace(/'/g, "''")}'::vector
                    LIMIT ${limit * 2}
                `))
            } catch (error) {
                // Fallback: JavaScript cosine similarity
                console.warn('[PgVector] SyncedItem search: Extension not available, using JavaScript fallback')
                
                const syncedItems = await db.syncedItem.findMany({
                    where: {
                        connectionId: { in: connectionIds },
                        NOT: { embeddings: { isEmpty: true } }
                    },
                    select: {
                        id: true,
                        title: true,
                        content: true,
                        itemType: true,
                        url: true,
                        embeddings: true
                    },
                    take: limit * 5
                })

                const calculateCosineSimilarity = (a: number[], b: number[]): number => {
                    if (!a || !b || a.length !== b.length || a.length === 0) return 0
                    let dotProduct = 0
                    let normA = 0
                    let normB = 0
                    for (let i = 0; i < a.length; i++) {
                        const aVal = a[i] ?? 0
                        const bVal = b[i] ?? 0
                        dotProduct += aVal * bVal
                        normA += aVal * aVal
                        normB += bVal * bVal
                    }
                    const denominator = Math.sqrt(normA) * Math.sqrt(normB)
                    return denominator > 0 ? dotProduct / denominator : 0
                }

                results = syncedItems
                    .filter(si => si.embeddings && Array.isArray(si.embeddings) && si.embeddings.length === 1536)
                    .map(si => {
                        const embeddings = (si.embeddings as number[]) || []
                        return {
                            id: si.id,
                            title: si.title,
                            content: si.content,
                            itemType: si.itemType,
                            url: si.url,
                            similarity: calculateCosineSimilarity(queryEmbeddings!, embeddings)
                        }
                    })
                    .sort((a, b) => b.similarity - a.similarity)
                    .slice(0, limit * 2)
            }

            const filteredResults = results
                .filter(r => r.similarity >= similarityThreshold)
                .slice(0, limit)

            const hits = filteredResults.map(result => ({
                id: result.id,
                score: result.similarity,
                document: {
                    title: result.title,
                    content: result.content,
                    source: result.itemType === 'file' ? 'google_drive' : 
                           result.itemType === 'document' ? 'sharepoint' :
                           result.itemType === 'event' ? 'google_calendar' : 'synced_item',
                    sourceId: result.id,
                    fileName: result.title,
                    url: result.url,
                    embeddings: []
                }
            }))

            return hits
        } catch (error) {
            console.error('Error in searchSyncedItems:', error)
            return []
        }
    }

    /**
     * Search all sources (emails, files, integrations) using vector search
     * This is the main method for RAG - searches across all data sources
     */
    async vectorSearchAllSources({ 
        term, 
        preferredEmailIds,
        limit = 20,
        similarityThreshold = 0.6
    }: { 
        term: string
        preferredEmailIds?: string[]
        limit?: number
        similarityThreshold?: number
    }) {
        try {
            // Get embeddings once for all searches
            const queryEmbeddings = await getEmbeddings(term)
            
            // Search all sources in parallel
            const [emailResults, fileResults, syncedResults] = await Promise.all([
                this.vectorSearch({ 
                    term, 
                    preferredEmailIds, 
                    limit: Math.ceil(limit * 0.5), // 50% for emails
                    similarityThreshold 
                }).catch(err => {
                    console.error('Error searching emails:', err)
                    return { hits: [] }
                }),
                this.searchChatAttachments(
                    term, 
                    queryEmbeddings, 
                    Math.ceil(limit * 0.25), // 25% for files
                    similarityThreshold
                ).catch(err => {
                    console.error('Error searching files:', err)
                    return []
                }),
                this.searchSyncedItems(
                    term, 
                    queryEmbeddings, 
                    Math.ceil(limit * 0.25), // 25% for integrations
                    similarityThreshold
                ).catch(err => {
                    console.error('Error searching synced items:', err)
                    return []
                })
            ])

            // Combine all results
            const allHits = [
                ...(emailResults.hits || []),
                ...(fileResults || []),
                ...(syncedResults || [])
            ]

            // Sort by similarity score and return top results
            const sortedHits = allHits
                .sort((a, b) => (b.score || 0) - (a.score || 0))
                .slice(0, limit)

            console.log(`[PgVector] Multi-source search: ${emailResults.hits?.length || 0} emails, ${fileResults?.length || 0} files, ${syncedResults?.length || 0} synced items`)

            return {
                hits: sortedHits,
                count: sortedHits.length
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes("quota") || errorMessage.includes("exceeded") || errorMessage.includes("billing")) {
                console.warn("[QUOTA] Multi-source search failed, falling back to email-only search");
                return await this.vectorSearch({ term, limit });
            }
            throw error;
        }
    }

    /**
     * Search by source (email, file, etc.) - kept for backward compatibility
     */
    async searchBySource({ term, source }: { term: string, source: string }) {
        if (source === 'email') {
            return await this.vectorSearch({ term })
        }
        
        if (source === 'file') {
            const hits = await this.searchChatAttachments(term)
            return { hits, count: hits.length }
        }
        
        // For other sources, use synced items search
        const hits = await this.searchSyncedItems(term)
        return { hits, count: hits.length }
    }

    /**
     * Insert/update email embeddings
     */
    async insert(document: any) {
        // For pgvector, we update the email directly in the database
        // This is typically called from sync-emails.ts
        if (document.source === 'email' && document.sourceId) {
            await db.email.update({
                where: { id: document.sourceId },
                data: {
                    embeddings: document.embeddings || []
                }
            })
        }
    }

    /**
     * Batch insert/update embeddings
     */
    async insertBatch(documents: any[]) {
        console.log(`[PgVector] Inserting ${documents.length} documents for account ${this.accountId}`)
        
        for (const document of documents) {
            await this.insert(document)
        }
        
        console.log(`[PgVector] Successfully inserted ${documents.length} documents`)
    }

    /**
     * Get approximate count of documents with embeddings across all sources
     */
    async getDocumentCount(): Promise<number> {
        try {
            const account = await db.account.findUnique({
                where: { id: this.accountId },
                select: { id: true }
            })
            
            if (!account) {
                return 0
            }

            // Count emails with embeddings
            const threads = await db.thread.findMany({
                where: { accountId: this.accountId },
                select: { id: true }
            })
            const threadIds = threads.map(t => t.id)

            const emailCount = threadIds.length > 0 ? await db.email.count({
                where: {
                    threadId: { in: threadIds },
                    NOT: { embeddings: { isEmpty: true } }
                }
            }) : 0

            // Count ChatAttachments with embeddings
            const fileCount = await db.chatAttachment.count({
                where: {
                    accountId: this.accountId,
                    NOT: { textEmbeddings: { isEmpty: true } }
                }
            })

            // Count SyncedItems with embeddings
            const connections = await db.appConnection.findMany({
                where: {
                    OR: [
                        { accountId: this.accountId },
                        { userId: account.id }
                    ]
                },
                select: { id: true }
            })
            const connectionIds = connections.map(c => c.id)

            const syncedCount = connectionIds.length > 0 ? await db.syncedItem.count({
                where: {
                    connectionId: { in: connectionIds },
                    NOT: { embeddings: { isEmpty: true } }
                }
            }) : 0

            const total = emailCount + fileCount + syncedCount
            console.log(`[PgVector] Document counts - Emails: ${emailCount}, Files: ${fileCount}, Synced: ${syncedCount}, Total: ${total}`)
            
            return total
        } catch (error) {
            console.error("[PgVector] Error getting document count:", error)
            return 0
        }
    }
}
