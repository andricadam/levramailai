import 'dotenv/config'
import { PrismaClient } from '../../generated/prisma'

const prisma = new PrismaClient()
const db = prisma

async function cleanDatabase() {
  console.log('🧹 Starting database cleanup...')
  
  try {
    // Delete in correct order to respect foreign key constraints
    
    // 1. Delete email attachments (references Email)
    console.log('Deleting email attachments...')
    const attachmentsCount = await db.emailAttachment.deleteMany({})
    console.log(`✅ Deleted ${attachmentsCount.count} email attachments`)
    
    // 2. Delete emails (references Thread and EmailAddress)
    console.log('Deleting emails...')
    const emailsCount = await db.email.deleteMany({})
    console.log(`✅ Deleted ${emailsCount.count} emails`)
    
    // 3. Delete threads (references Account)
    console.log('Deleting threads...')
    const threadsCount = await db.thread.deleteMany({})
    console.log(`✅ Deleted ${threadsCount.count} threads`)
    
    // 4. Delete email addresses (references Account)
    console.log('Deleting email addresses...')
    const emailAddressesCount = await db.emailAddress.deleteMany({})
    console.log(`✅ Deleted ${emailAddressesCount.count} email addresses`)
    
    // 5. Delete chat attachments (references Account and User)
    console.log('Deleting chat attachments...')
    const chatAttachmentsCount = await db.chatAttachment.deleteMany({})
    console.log(`✅ Deleted ${chatAttachmentsCount.count} chat attachments`)
    
    // 6. Delete app connections (references Account and User)
    console.log('Deleting app connections...')
    const appConnectionsCount = await db.appConnection.deleteMany({})
    console.log(`✅ Deleted ${appConnectionsCount.count} app connections`)
    
    // 7. Delete synced items (references AppConnection)
    console.log('Deleting synced items...')
    const syncedItemsCount = await db.syncedItem.deleteMany({})
    console.log(`✅ Deleted ${syncedItemsCount.count} synced items`)
    
    // 8. Delete accounts (references User)
    console.log('Deleting accounts...')
    const accountsCount = await db.account.deleteMany({})
    console.log(`✅ Deleted ${accountsCount.count} accounts`)
    
    // 9. Delete user-related data
    console.log('Deleting user-related data...')
    const chatbotInteractionsCount = await db.chatbotInteraction.deleteMany({})
    const chatFeedbackCount = await db.chatFeedback.deleteMany({})
    const instantReplyFeedbackCount = await db.instantReplyFeedback.deleteMany({})
    const stripeSubscriptionsCount = await db.stripeSubscription.deleteMany({})
    console.log(`✅ Deleted ${chatbotInteractionsCount.count} chatbot interactions`)
    console.log(`✅ Deleted ${chatFeedbackCount.count} chat feedback entries`)
    console.log(`✅ Deleted ${instantReplyFeedbackCount.count} instant reply feedback entries`)
    console.log(`✅ Deleted ${stripeSubscriptionsCount.count} stripe subscriptions`)
    
    // 10. Delete users (last, as everything references it)
    console.log('Deleting users...')
    const usersCount = await db.user.deleteMany({})
    console.log(`✅ Deleted ${usersCount.count} users`)
    
    console.log('\n✨ Database cleanup completed successfully!')
    console.log('\n📝 Next steps:')
    console.log('   1. Sign out from your current session')
    console.log('   2. Sign up/sign in again as a new user')
    console.log('   3. Connect your Gmail/Outlook accounts')
    console.log('   4. Watch the console logs for sync progress')
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error)
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    throw error
  }
}

cleanDatabase()
  .then(async () => {
    console.log('\n✅ Done!')
    await prisma.$disconnect()
    process.exit(0)
  })
  .catch(async (error) => {
    console.error('\n❌ Failed:', error)
    await prisma.$disconnect()
    process.exit(1)
  })

