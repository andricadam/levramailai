"use server"
import axios from 'axios'
import { GoogleEmailOAuth } from '../email-oauth/google-email-oauth'
import { db } from '@/server/db'

/**
 * Get a valid access token, refreshing if necessary
 */
async function getValidAccessToken(accountId: string): Promise<string> {
  const account = await db.account.findUnique({
    where: { id: accountId },
    select: {
      accessToken: true,
      refreshToken: true,
      expiresAt: true,
      provider: true,
    },
  })

  if (!account) {
    throw new Error('Account not found')
  }

  if (account.provider !== 'google') {
    throw new Error('Account is not a Google account')
  }

  // Check if token needs refresh (refresh 5 minutes before expiry)
  const needsRefresh = account.expiresAt && 
    account.refreshToken &&
    new Date(account.expiresAt.getTime() - 5 * 60 * 1000) <= new Date()

  if (needsRefresh && account.refreshToken) {
    try {
      const oauth = new GoogleEmailOAuth()
      const tokens = await oauth.refreshToken(account.refreshToken)

      // Update account with new tokens
      await db.account.update({
        where: { id: accountId },
        data: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: tokens.expires_at,
        },
      })

      return tokens.access_token
    } catch (error) {
      console.error('Error refreshing Google token:', error)
      throw new Error('Failed to refresh access token')
    }
  }

  return account.accessToken
}

export class GoogleCalendarAPI {
  private accountId: string

  constructor(accountId: string) {
    this.accountId = accountId
  }

  private async getAccessToken(): Promise<string> {
    return await getValidAccessToken(this.accountId)
  }

  /**
   * List calendar events
   */
  async listEvents(params?: {
    timeMin?: string
    timeMax?: string
    maxResults?: number
    pageToken?: string
    calendarId?: string // Defaults to 'primary'
  }) {
    const accessToken = await this.getAccessToken()
    const calendarId = params?.calendarId || 'primary'
    const queryParams = new URLSearchParams()
    
    if (params?.timeMin) queryParams.set('timeMin', params.timeMin)
    if (params?.timeMax) queryParams.set('timeMax', params.timeMax)
    if (params?.maxResults) queryParams.set('maxResults', params.maxResults.toString())
    if (params?.pageToken) queryParams.set('pageToken', params.pageToken)

    const response = await axios.get(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?${queryParams.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )
    return response.data
  }

  /**
   * Get a specific event
   */
  async getEvent(eventId: string, calendarId: string = 'primary') {
    const accessToken = await this.getAccessToken()
    const response = await axios.get(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )
    return response.data
  }

  /**
   * List calendars
   */
  async listCalendars() {
    const accessToken = await this.getAccessToken()
    const response = await axios.get(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )
    return response.data
  }
}

