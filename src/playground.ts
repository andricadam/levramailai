import 'dotenv/config'
import { create, insert, search, type AnyOrama } from '@orama/orama'
import { db } from './server/db.js'
import { OramaClient } from './lib/orama.js'

const orama = new OramaClient('161359')
await orama.initialize()

// const emails = await db.email.findMany({
//     select: {
//         subject: true,
//         body: true,
//         from: true,
//         to: true,
//         sentAt: true,
//         threadId: true,
//     }
// })
// for (const email of emails) {
//     await orama.insert({
//         subject: email.subject,
//         body: email.body ?? undefined,
//         from: email.from.address,
//         to: email.to.map(to => to.address),
//         sentAt: email.sentAt.toLocaleString(),
//         threadId: email.threadId,
//     })
//     
// }

const searchResult = await orama.search({
    term: 'test',
})
for (const hit of searchResult.hits) {
    console.log(hit.document.subject)
}