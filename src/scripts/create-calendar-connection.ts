import 'dotenv/config'
import { db } from '../server/db'
import { syncGoogleCalendar } from '../lib/integrations/google-calendar-sync'
import { syncMicrosoftCalendar } from '../lib/integrations/microsoft-calendar-sync'

async function createCalendarConnection() {
  try {
    // Get user ID and optional provider from command line arguments
    const userId = process.argv[2]
    const providerArg = process.argv[3]?.toLowerCase() // Optional: 'google' or 'microsoft'

    if (!userId) {
      console.error('❌ Please provide your user ID as an argument')
      console.log('Usage: npx tsx src/scripts/create-calendar-connection.ts <your-user-id> [provider]')
      console.log('\nOptional provider argument:')
      console.log('  - "google" - Create Google Calendar connection')
      console.log('  - "microsoft" - Create Microsoft Calendar connection')
      console.log('  - (none) - Auto-detect and create for all accounts')
      console.log('\nTo find your user ID, run:')
      console.log('  SELECT id, "emailAddress" FROM "User";')
      process.exit(1)
    }

    console.log(`🔍 Looking for accounts for user: ${userId}`)

    // Find accounts based on provider argument
    const whereClause: any = { userId }
    if (providerArg === 'google' || providerArg === 'microsoft') {
      whereClause.provider = providerArg
    }

    const accounts = await db.account.findMany({
      where: whereClause,
      select: { id: true, emailAddress: true, provider: true, accessToken: true, refreshToken: true, expiresAt: true },
    })

    if (accounts.length === 0) {
      console.error('❌ No accounts found for this user')
      if (providerArg) {
        console.error(`   (filtered by provider: ${providerArg})`)
      }
      console.log('\nAvailable accounts:')
      const allAccounts = await db.account.findMany({
        where: { userId },
        select: { id: true, emailAddress: true, provider: true },
      })
      if (allAccounts.length === 0) {
        console.log('   (none)')
      } else {
        allAccounts.forEach(acc => {
          console.log(`  - ${acc.emailAddress} (${acc.provider})`)
        })
      }
      process.exit(1)
    }

    // Process each account
    for (const account of accounts) {
      const isGoogle = account.provider === 'google'
      const isMicrosoft = account.provider === 'microsoft'
      const appType = isGoogle ? 'google_calendar' : isMicrosoft ? 'microsoft_calendar' : null
      const appName = isGoogle ? 'Google Calendar' : isMicrosoft ? 'Microsoft Calendar' : null

      if (!appType || !appName) {
        console.log(`⏭️  Skipping ${account.emailAddress} (${account.provider}) - calendar not supported`)
        continue
      }

      console.log(`\n📧 Processing ${account.provider} account: ${account.emailAddress}`)

      // Check if calendar connection already exists for this account
      const existingConnection = await db.appConnection.findFirst({
        where: {
          userId,
          accountId: account.id,
          appType,
        },
      })

      if (existingConnection) {
        console.log(`ℹ️  ${appName} connection already exists!`)
        console.log(`   Connection ID: ${existingConnection.id}`)
        console.log(`   Enabled: ${existingConnection.enabled}`)
        console.log(`   Sync Status: ${existingConnection.syncStatus}`)
        
        if (!existingConnection.enabled) {
          console.log(`\n⚠️  Connection exists but is disabled. Enabling it...`)
          await db.appConnection.update({
            where: { id: existingConnection.id },
            data: { enabled: true },
          })
          console.log('✅ Connection enabled!')
        }
        
        // Trigger sync
        console.log(`\n🔄 Triggering ${appName} sync...`)
        try {
          if (isGoogle) {
            await syncGoogleCalendar(existingConnection.id)
          } else if (isMicrosoft) {
            await syncMicrosoftCalendar(existingConnection.id)
          }
          console.log(`✅ ${appName} sync completed!`)
        } catch (error) {
          console.error(`⚠️  Sync error (this is okay, it runs in background):`, error)
        }
        continue
      }

      // Create the calendar connection
      console.log(`\n📅 Creating ${appName} connection...`)
      const calendarConnection = await db.appConnection.create({
        data: {
          userId,
          accountId: account.id,
          appType,
          appName,
          accessToken: account.accessToken,
          refreshToken: account.refreshToken || null,
          expiresAt: account.expiresAt || null,
          enabled: true,
          syncStatus: 'pending',
        },
      })

      console.log(`✅ ${appName} connection created successfully!`)
      console.log(`   Connection ID: ${calendarConnection.id}`)
      console.log(`   Account: ${account.emailAddress}`)
      
      // Trigger sync
      console.log(`\n🔄 Triggering ${appName} sync...`)
      try {
        if (isGoogle) {
          await syncGoogleCalendar(calendarConnection.id)
        } else if (isMicrosoft) {
          await syncMicrosoftCalendar(calendarConnection.id)
        }
        console.log(`✅ ${appName} sync completed!`)
      } catch (error) {
        console.error(`⚠️  Sync error (this is okay, it runs in background):`, error)
        console.log(`   The connection was created successfully. Sync will happen automatically.`)
      }
    }

    console.log('\n🎉 All done! Your calendar(s) should now be visible in the calendar view.')
  } catch (error) {
    console.error('❌ Error creating calendar connection:', error)
    if (error instanceof Error) {
      console.error('   Error message:', error.message)
      console.error('   Stack:', error.stack)
    }
    process.exit(1)
  } finally {
    await db.$disconnect()
  }
}

createCalendarConnection()
