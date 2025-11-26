import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/server/db'
import { GoogleOAuth } from '@/lib/integrations/google-oauth'
import { syncGoogleDrive } from '@/lib/integrations/google-drive-sync'
import { syncGoogleCalendar } from '@/lib/integrations/google-calendar-sync'

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.redirect('/sign-in')
  }

  const searchParams = new URL(req.url).searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  
  if (!code || !state) {
    return NextResponse.redirect('/settings/integrations?error=oauth_failed')
  }

  const [appType, accountId] = state.split(':')

  if (!appType || (appType !== 'google_drive' && appType !== 'google_calendar')) {
    return NextResponse.redirect('/settings/integrations?error=invalid_app_type')
  }

  try {
    const oauth = new GoogleOAuth()
    const tokens = await oauth.getTokens(code)

    if (!tokens.access_token) {
      throw new Error('No access token received')
    }

    // Create or update connection
    const connection = await db.appConnection.upsert({
      where: {
        userId_appType: {
          userId,
          appType,
        },
      },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || undefined,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
        syncStatus: 'pending',
        syncError: null,
      },
      create: {
        userId,
        accountId: accountId || undefined,
        appType,
        appName: appType === 'google_drive' ? 'Google Drive' : 'Google Calendar',
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || undefined,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
        syncStatus: 'pending',
      },
    })

    // Trigger initial sync in background (don't wait for it)
    if (appType === 'google_drive') {
      syncGoogleDrive(connection.id).catch((error) => {
        console.error('Background sync error for Google Drive:', error)
      })
    } else if (appType === 'google_calendar') {
      syncGoogleCalendar(connection.id).catch((error) => {
        console.error('Background sync error for Google Calendar:', error)
      })
    }

    return NextResponse.redirect('/settings/integrations?success=connected')
  } catch (error) {
    console.error('OAuth callback error:', error)
    return NextResponse.redirect('/settings/integrations?error=oauth_failed')
  }
}

