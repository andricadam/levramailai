import axios from 'axios'
import { env } from '@/env'

const MICROSOFT_CLIENT_ID = env.SERVER_MICROSOFT_CLIENT_ID
const MICROSOFT_CLIENT_SECRET = env.SERVER_MICROSOFT_CLIENT_SECRET
const MICROSOFT_REDIRECT_URI = env.SERVER_MICROSOFT_REDIRECT_URI ||
  `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/integrations/microsoft/callback`

export class MicrosoftOAuth {
  getAuthUrl(state: string) {
    if (!MICROSOFT_CLIENT_ID) {
      throw new Error('Microsoft OAuth credentials not configured')
    }

    const params = new URLSearchParams({
      client_id: MICROSOFT_CLIENT_ID,
      response_type: 'code',
      redirect_uri: MICROSOFT_REDIRECT_URI,
      response_mode: 'query',
      scope: 'https://graph.microsoft.com/Sites.Read.All offline_access',
      state,
    })
    
    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`
  }

  async getTokens(code: string) {
    if (!MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET) {
      throw new Error('Microsoft OAuth credentials not configured')
    }

    const response = await axios.post(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      new URLSearchParams({
        client_id: MICROSOFT_CLIENT_ID,
        client_secret: MICROSOFT_CLIENT_SECRET,
        code,
        redirect_uri: MICROSOFT_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    )
    
    return response.data
  }

  async refreshToken(refreshToken: string) {
    if (!MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET) {
      throw new Error('Microsoft OAuth credentials not configured')
    }

    const response = await axios.post(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      new URLSearchParams({
        client_id: MICROSOFT_CLIENT_ID,
        client_secret: MICROSOFT_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        redirect_uri: MICROSOFT_REDIRECT_URI,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    )
    
    return response.data
  }
}

