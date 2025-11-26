import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { GoogleOAuth, GOOGLE_DRIVE_SCOPES, GOOGLE_CALENDAR_SCOPES } from '@/lib/integrations/google-oauth'

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.redirect('/sign-in')
  }

  const searchParams = new URL(req.url).searchParams
  const appType = searchParams.get('type') // 'google_drive' | 'google_calendar'
  const accountId = searchParams.get('accountId') || ''

  if (!appType || (appType !== 'google_drive' && appType !== 'google_calendar')) {
    return NextResponse.json({ error: 'Invalid app type' }, { status: 400 })
  }

  try {
    const oauth = new GoogleOAuth()
    const scopes = appType === 'google_drive' ? GOOGLE_DRIVE_SCOPES : GOOGLE_CALENDAR_SCOPES
    const state = `${appType}:${accountId}`
    const authUrl = oauth.getAuthUrl(state, scopes)

    return NextResponse.redirect(authUrl)
  } catch (error) {
    console.error('OAuth connect error:', error)
    return NextResponse.redirect(`/settings/integrations?error=oauth_failed`)
  }
}

