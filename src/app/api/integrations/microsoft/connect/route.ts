import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { MicrosoftOAuth } from '@/lib/integrations/microsoft-oauth'

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.redirect('/sign-in')
  }

  const searchParams = new URL(req.url).searchParams
  const accountId = searchParams.get('accountId') || ''

  try {
    const oauth = new MicrosoftOAuth()
    const state = `sharepoint:${accountId}`
    const authUrl = oauth.getAuthUrl(state)

    return NextResponse.redirect(authUrl)
  } catch (error) {
    console.error('OAuth connect error:', error)
    return NextResponse.redirect(`/settings/integrations?error=oauth_failed`)
  }
}

