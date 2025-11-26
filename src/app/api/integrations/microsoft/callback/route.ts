import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/server/db'
import { MicrosoftOAuth } from '@/lib/integrations/microsoft-oauth'
import { syncSharePoint } from '@/lib/integrations/sharepoint-sync'

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

  if (appType !== 'sharepoint') {
    return NextResponse.redirect('/settings/integrations?error=invalid_app_type')
  }

  try {
    const oauth = new MicrosoftOAuth()
    const tokens = await oauth.getTokens(code)

    if (!tokens.access_token) {
      throw new Error('No access token received')
    }

    const connection = await db.appConnection.upsert({
      where: {
        userId_appType: {
          userId,
          appType: 'sharepoint',
        },
      },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: tokens.expires_in 
          ? new Date(Date.now() + tokens.expires_in * 1000)
          : undefined,
        syncStatus: 'pending',
        syncError: null,
      },
      create: {
        userId,
        accountId: accountId || undefined,
        appType: 'sharepoint',
        appName: 'SharePoint',
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: tokens.expires_in 
          ? new Date(Date.now() + tokens.expires_in * 1000)
          : undefined,
        syncStatus: 'pending',
      },
    })

    // Trigger initial sync in background
    syncSharePoint(connection.id).catch((error) => {
      console.error('Background sync error for SharePoint:', error)
    })

    return NextResponse.redirect('/settings/integrations?success=connected')
  } catch (error) {
    console.error('OAuth callback error:', error)
    return NextResponse.redirect('/settings/integrations?error=oauth_failed')
  }
}

