import { OramaClient } from './orama'
import { UI_KNOWLEDGE_BASE } from './ui-knowledge-base'
import { getEmbeddings } from './embedding'
import { db } from '@/server/db'

/**
 * Initialize UI knowledge base in Orama for all accounts
 * This should be run once during app setup or when UI knowledge is updated
 */
export async function initializeUIKnowledge() {
  const accounts = await db.account.findMany({
    select: { id: true }
  })

  console.log(`Initializing UI knowledge for ${accounts.length} accounts`)

  for (const account of accounts) {
    try {
      await initializeUIKnowledgeForAccount(account.id)
    } catch (error) {
      console.error(`Failed to initialize UI knowledge for account ${account.id}:`, error)
    }
  }

  console.log('UI knowledge initialization completed')
}

/**
 * Initialize UI knowledge for a specific account
 */
export async function initializeUIKnowledgeForAccount(accountId: string) {
  try {
    const orama = new OramaClient(accountId)
    await orama.initialize()

    let indexedCount = 0

    // Index each UI knowledge item separately for better search
    for (const item of UI_KNOWLEDGE_BASE) {
      const itemText = `[${item.category}] ${item.title}\n\n${item.content}\n\nLocation: ${item.location || 'N/A'}\nRoute: ${item.route || 'N/A'}\nKeywords: ${item.keywords.join(', ')}`
      
      try {
        const itemEmbeddings = await getEmbeddings(itemText.substring(0, 8000))

        await orama.insert({
          subject: item.title,
          body: itemText,
          rowBody: itemText,
          from: 'system',
          to: [],
          sentAt: new Date().toISOString(),
          threadId: `ui-${item.id}`,
          source: 'ui_help',
          sourceId: item.id,
          fileName: item.title,
          embeddings: itemEmbeddings,
        } as any)

        indexedCount++
      } catch (error) {
        console.error(`Failed to index UI item ${item.id}:`, error)
      }
    }

    console.log(`Initialized ${indexedCount} UI knowledge items for account ${accountId}`)
  } catch (error) {
    console.error(`Failed to initialize UI knowledge for account ${accountId}:`, error)
    throw error
  }
}

/**
 * Check if UI knowledge is already initialized for an account
 * (by checking if any ui_help sources exist in Orama)
 */
export async function isUIKnowledgeInitialized(accountId: string): Promise<boolean> {
  try {
    const orama = new OramaClient(accountId)
    await orama.initialize()

    // Search for any UI help items using vector search
    const results = await orama.vectorSearch({
      term: 'how to use the app',
      limit: 10,
    })

    // Check if any results have ui_help source
    const hasUIHelp = results.hits.some((hit: any) => hit.document?.source === 'ui_help')
    return hasUIHelp
  } catch (error) {
    console.error(`Failed to check UI knowledge initialization for account ${accountId}:`, error)
    return false
  }
}

