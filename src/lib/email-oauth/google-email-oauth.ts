import { OAuth2Client } from 'google-auth-library'
import { env } from '@/env'

const GOOGLE_CLIENT_ID = env.SERVER_GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = env.SERVER_GOOGLE_CLIENT_SECRET
const GOOGLE_REDIRECT_URI = env.SERVER_GOOGLE_REDIRECT_URI || 
  `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/google/callback`

// Scopes for Gmail and Calendar
export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
]

export const GOOGLE_CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
]

export const GOOGLE_EMAIL_SCOPES = [
  ...GMAIL_SCOPES,
  ...GOOGLE_CALENDAR_SCOPES,
]

export class GoogleEmailOAuth {
  private client: OAuth2Client

  constructor() {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      throw new Error('Google OAuth credentials not configured')
    }

    this.client = new OAuth2Client(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI
    )
  }

  getAuthUrl(state?: string) {
    return this.client.generateAuthUrl({
      access_type: 'offline',
      scope: GOOGLE_EMAIL_SCOPES,
      state: state || '',
      prompt: 'consent', // Force refresh token
    })
  }

  async getTokens(code: string) {
    const { tokens } = await this.client.getToken(code)
    return {
      access_token: tokens.access_token!,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expiry_date ? Math.floor((tokens.expiry_date - Date.now()) / 1000) : undefined,
      expiry_date: tokens.expiry_date,
    }
  }

  async refreshToken(refreshToken: string) {
    this.client.setCredentials({ refresh_token: refreshToken })
    const { credentials } = await this.client.refreshAccessToken()
    return {
      access_token: credentials.access_token!,
      refresh_token: credentials.refresh_token || refreshToken,
      expires_in: credentials.expiry_date ? Math.floor((credentials.expiry_date - Date.now()) / 1000) : undefined,
      expiry_date: credentials.expiry_date,
    }
  }
}
