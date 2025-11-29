import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { MicrosoftEmailOAuth } from '@/lib/email-oauth/microsoft-email-oauth'
import { getSubscriptionStatus } from '@/lib/stripe-actions'
import { db } from '@/server/db'
import { PRO_ACCOUNTS_PER_USER, FREE_ACCOUNTS_PER_USER } from '@/constants'
import { type NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.redirect(new URL('/sign-in?redirect_url=/mail', req.url))
    }

    // Check account limits
    const isSubscribed = await getSubscriptionStatus()
    const accounts = await db.account.count({ where: { userId } })
    
    if (isSubscribed) {
      if (accounts >= PRO_ACCOUNTS_PER_USER) {
        return NextResponse.redirect(new URL('/mail?error=Account limit reached', req.url))
      }
    } else {
      if (accounts >= FREE_ACCOUNTS_PER_USER) {
        return NextResponse.redirect(new URL('/mail?error=Account limit reached', req.url))
      }
    }

    const oauth = new MicrosoftEmailOAuth()
    const state = userId // Use userId as state for security
    const authUrl = oauth.getAuthUrl(state)

    return NextResponse.redirect(authUrl)
  } catch (error) {
    console.error('Microsoft OAuth connect error:', error)
    const errorMessage = error instanceof Error ? error.message : 'OAuth connection failed'
    return NextResponse.redirect(new URL(`/mail?error=${encodeURIComponent(errorMessage)}`, req.url))
  }
}
