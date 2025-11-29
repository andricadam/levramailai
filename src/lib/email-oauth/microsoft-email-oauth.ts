import axios from 'axios'
import { env } from '@/env'

const MICROSOFT_CLIENT_ID = env.SERVER_MICROSOFT_CLIENT_ID
const MICROSOFT_CLIENT_SECRET = env.SERVER_MICROSOFT_CLIENT_SECRET
const MICROSOFT_REDIRECT_URI = env.SERVER_MICROSOFT_REDIRECT_URI ||
  `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/microsoft/callback`
const MICROSOFT_TENANT_ID = process.env.MICROSOFT_TENANT_ID || 'common'

// Scopes for Microsoft Graph (Mail + Calendar)
export const MICROSOFT_EMAIL_SCOPES = [
  'https://graph.microsoft.com/Mail.Read',
  'https://graph.microsoft.com/Mail.ReadWrite',
  'https://graph.microsoft.com/Mail.Send',
  'https://graph.microsoft.com/Calendars.Read',
  'https://graph.microsoft.com/Calendars.ReadWrite',
  'https://graph.microsoft.com/User.Read',
  'offline_access', // Required for refresh tokens
]

export class MicrosoftEmailOAuth {
  private getAuthBaseUrl() {
    return `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/oauth2/v2.0`
  }

  getAuthUrl(state?: string) {
    if (!MICROSOFT_CLIENT_ID) {
      throw new Error('Microsoft OAuth credentials not configured')
    }

    const params = new URLSearchParams({
      client_id: MICROSOFT_CLIENT_ID,
      response_type: 'code',
      redirect_uri: MICROSOFT_REDIRECT_URI,
      response_mode: 'query',
      scope: MICROSOFT_EMAIL_SCOPES.join(' '),
      state: state || '',
      prompt: 'consent', // Force refresh token
    })
    
    return `${this.getAuthBaseUrl()}/authorize?${params}`
  }

  async getTokens(code: string) {
    if (!MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET) {
      throw new Error('Microsoft OAuth credentials not configured')
    }

    const response = await axios.post(
      `${this.getAuthBaseUrl()}/token`,
      new URLSearchParams({
        client_id: MICROSOFT_CLIENT_ID,
        client_secret: MICROSOFT_CLIENT_SECRET,
        code,
        redirect_uri: MICROSOFT_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    )
    
    return {
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token,
      expires_in: response.data.expires_in,
      expiry_date: response.data.expires_in 
        ? new Date(Date.now() + response.data.expires_in * 1000)
        : undefined,
    }
  }

  async refreshToken(refreshToken: string) {
    if (!MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET) {
      throw new Error('Microsoft OAuth credentials not configured')
    }

    const response = await axios.post(
      `${this.getAuthBaseUrl()}/token`,
      new URLSearchParams({
        client_id: MICROSOFT_CLIENT_ID,
        client_secret: MICROSOFT_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        redirect_uri: MICROSOFT_REDIRECT_URI,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    )
    
    return {
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token || refreshToken,
      expires_in: response.data.expires_in,
      expiry_date: response.data.expires_in 
        ? new Date(Date.now() + response.data.expires_in * 1000)
        : undefined,
    }
  }
}
