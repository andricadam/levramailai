import 'dotenv/config'
import { create, insert, search, type AnyOrama } from '@orama/orama'
import { db } from './server/db.js'
import { OramaClient } from './lib/orama.js'
import { turndown } from './lib/turndown.js'
import { getEmbeddings } from './lib/embedding.js'

const orama = new OramaClient('161359')
await orama.initialize()

 // const emails = await db.email.findMany({
 //    select: {
 //        subject: true,
 //        body: true,
 //        bodySnippet: true,
 //        from: true,
 //        to: true,
 //        sentAt: true,
 //        threadId: true,
 //    }
 // })
 //
 // let successCount = 0
 // let errorCount = 0
 //
 // const results = await Promise.all(emails.map(async (email) => {
 //    try {
 //        const body = turndown.turndown(email.body ?? email.bodySnippet ?? '')
 //        const embeddings = await getEmbeddings(body)
 //        console.log(`✓ Processing: "${email.subject}" (${embeddings.length} dimensions)`)
 //        await orama.insert({
 //            subject: email.subject,
 //            body: email.body ?? undefined,
 //            from: email.from.address,
 //            to: email.to.map(to => to.address),
 //            sentAt: email.sentAt.toLocaleString(),
 //            threadId: email.threadId,
 //            embeddings
 //        })
 //        return { success: true }
 //    } catch (error) {
 //        console.error(`✗ Failed to process email "${email.subject}":`, error instanceof Error ? error.message : error)
 //        return { success: false, error }
 //    }
 // }))
 // await orama.saveIndex()

//console.log(`\nSummary: ${successCount} successful, ${errorCount} failed out of ${emails.length} total emails`)

const searchResult = await orama.vectorSearch({
    term: 'test',
})
for (const hit of searchResult.hits) {
    console.log(hit.document.subject)
}