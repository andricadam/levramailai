import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { type NextRequest } from 'next/server'
import { MicrosoftEmailOAuth } from '@/lib/email-oauth/microsoft-email-oauth'
import { db } from '@/server/db'
import { MicrosoftGraphAPI } from '@/lib/email-api/microsoft-graph-api'
import { syncEmailsToDatabase } from '@/lib/sync-emails'
import { initializeUIKnowledgeForAccount, isUIKnowledgeInitialized } from '@/lib/init-ui-knowledge'
import { syncMicrosoftCalendar } from '@/lib/integrations/microsoft-calendar-sync'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.redirect(new URL('/sign-in?redirect_url=/mail', req.url))
    }

    const params = req.nextUrl.searchParams
    const code = params.get('code')
    const state = params.get('state')
    const error = params.get('error')
    const errorDescription = params.get('error_description')

    // Handle OAuth errors
    if (error) {
      console.error('Microsoft OAuth error:', error, errorDescription)
      return NextResponse.redirect(new URL(`/mail?error=${encodeURIComponent(errorDescription || error)}`, req.url))
    }

    if (!code) {
      return NextResponse.redirect(new URL('/mail?error=No authorization code provided', req.url))
    }

    // Verify state matches userId for security
    if (state !== userId) {
      return NextResponse.redirect(new URL('/mail?error=Invalid state parameter', req.url))
    }

    // Exchange code for tokens
    let tokens
    try {
      const oauth = new MicrosoftEmailOAuth()
      tokens = await oauth.getTokens(code)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to exchange code for tokens'
      console.error('Token exchange error:', errorMessage)
      return NextResponse.redirect(new URL(`/mail?error=${encodeURIComponent(errorMessage)}`, req.url))
    }

    if (!tokens.access_token) {
      return NextResponse.redirect(new URL('/mail?error=No access token received', req.url))
    }

    // Get account details from Microsoft Graph API
    let accountDetails
    try {
      const graph = new MicrosoftGraphAPI(tokens.access_token)
      accountDetails = await graph.getProfile()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch account details'
      console.error('Account details error:', errorMessage)
      return NextResponse.redirect(new URL(`/mail?error=${encodeURIComponent(errorMessage)}`, req.url))
    }

    // Ensure the User exists
    let user
    try {
      user = await currentUser()
      if (!user) {
        return NextResponse.redirect(new URL('/mail?error=User not found in Clerk', req.url))
      }

      const primaryEmail = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress
        || user.emailAddresses[0]?.emailAddress

      if (!primaryEmail) {
        return NextResponse.redirect(new URL('/mail?error=User email not found', req.url))
      }

      await db.user.upsert({
        where: { id: userId },
        update: {
          emailAddress: primaryEmail,
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          imageUrl: user.imageUrl || null,
        },
        create: {
          id: userId,
          emailAddress: primaryEmail,
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          imageUrl: user.imageUrl || null,
        },
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to ensure user exists'
      console.error('User upsert error:', errorMessage)
      return NextResponse.redirect(new URL(`/mail?error=${encodeURIComponent(errorMessage)}`, req.url))
    }

    // Save account to database
    try {
      const accountId = `microsoft_${accountDetails.emailAddress}`
      const expiresAt = tokens.expiry_date || (tokens.expires_in 
        ? new Date(Date.now() + tokens.expires_in * 1000) 
        : null)

      await db.account.upsert({
        where: {
          unique_user_email_provider: {
            userId,
            emailAddress: accountDetails.emailAddress,
            provider: 'microsoft',
          },
        },
        create: {
          id: accountId,
          userId,
          provider: 'microsoft',
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || null,
          expiresAt,
          emailAddress: accountDetails.emailAddress,
          name: accountDetails.name || accountDetails.emailAddress,
        },
        update: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || undefined,
          expiresAt: expiresAt || undefined,
        },
      })

      // Trigger initial sync in background
      const graph = new MicrosoftGraphAPI(tokens.access_token)
      graph.performInitialSync(accountId).catch((error) => {
        console.error('Background sync error for Microsoft account:', error)
        console.error('Error details:', {
          accountId,
          errorMessage: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        })
      })

      // Auto-create calendar AppConnection and sync calendar events
      try {
        // Check if calendar connection already exists
        const existingCalendarConnection = await db.appConnection.findFirst({
          where: {
            userId,
            appType: 'microsoft_calendar',
          },
        })

        let calendarConnectionId: string

        if (existingCalendarConnection) {
          // Update existing connection with new tokens
          calendarConnectionId = existingCalendarConnection.id
          await db.appConnection.update({
            where: { id: calendarConnectionId },
            data: {
              accountId,
              accessToken: tokens.access_token,
              refreshToken: tokens.refresh_token || undefined,
              expiresAt: expiresAt || undefined,
              enabled: true,
            },
          })
        } else {
          // Create new calendar connection linked to the email account
          const newConnection = await db.appConnection.create({
            data: {
              userId,
              accountId,
              appType: 'microsoft_calendar',
              appName: 'Microsoft Calendar',
              accessToken: tokens.access_token,
              refreshToken: tokens.refresh_token || null,
              expiresAt: expiresAt || null,
              enabled: true,
              syncStatus: 'pending',
            },
          })
          calendarConnectionId = newConnection.id
        }

        // Trigger calendar sync in background
        syncMicrosoftCalendar(calendarConnectionId).catch((error) => {
          console.error('Background calendar sync error:', error)
          console.error('Error details:', {
            calendarConnectionId,
            accountId,
            errorMessage: error instanceof Error ? error.message : String(error),
          })
        })
      } catch (error) {
        console.error('Error setting up calendar connection:', error)
        // Don't fail the whole flow if calendar setup fails
      }

      // Initialize UI knowledge
      try {
        const isInitialized = await isUIKnowledgeInitialized(accountId)
        if (!isInitialized) {
          initializeUIKnowledgeForAccount(accountId).catch(console.error)
        }
      } catch (error) {
        console.error('Error initializing UI knowledge:', error)
      }

      return NextResponse.redirect(new URL('/mail', req.url))
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save account to database'
      console.error('Database error:', errorMessage)
      return NextResponse.redirect(new URL(`/mail?error=${encodeURIComponent(errorMessage)}`, req.url))
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
    console.error('Unexpected error in callback:', errorMessage)
    return NextResponse.redirect(new URL(`/mail?error=${encodeURIComponent(errorMessage)}`, req.url))
  }
}
