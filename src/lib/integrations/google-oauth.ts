import { OAuth2Client } from 'google-auth-library'
import { env } from '@/env'

const GOOGLE_CLIENT_ID = env.SERVER_GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = env.SERVER_GOOGLE_CLIENT_SECRET
const GOOGLE_REDIRECT_URI = env.SERVER_GOOGLE_REDIRECT_URI || 
  `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/integrations/google/callback`

export class GoogleOAuth {
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

  getAuthUrl(state: string, scopes: string[]) {
    return this.client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state,
      prompt: 'consent', // Force refresh token
    })
  }

  async getTokens(code: string) {
    const { tokens } = await this.client.getToken(code)
    return tokens
  }

  async refreshToken(refreshToken: string) {
    this.client.setCredentials({ refresh_token: refreshToken })
    const { credentials } = await this.client.refreshAccessToken()
    return credentials
  }
}

// Scopes for each app
export const GOOGLE_DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
]

export const GOOGLE_CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
]

