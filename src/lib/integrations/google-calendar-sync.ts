import { google } from 'googleapis'
import { db } from '@/server/db'
import { getEmbeddings } from '@/lib/embedding'
import { PgVectorClient } from '@/lib/pgvector'
import { GoogleOAuth } from './google-oauth'

export async function syncGoogleCalendar(connectionId: string) {
  const connection = await db.appConnection.findUnique({
    where: { id: connectionId },
    include: { user: true }
  })

  if (!connection || connection.appType !== 'google_calendar') {
    throw new Error('Invalid connection')
  }

  // Check if token needs refresh
  let accessToken = connection.accessToken
  if (connection.expiresAt && connection.expiresAt < new Date() && connection.refreshToken) {
    try {
      const oauth = new GoogleOAuth()
      const credentials = await oauth.refreshToken(connection.refreshToken)
      accessToken = credentials.access_token!
      
      await db.appConnection.update({
        where: { id: connectionId },
        data: {
          accessToken: credentials.access_token!,
          refreshToken: credentials.refresh_token || connection.refreshToken,
          expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : undefined,
        },
      })
    } catch (error) {
      console.error('Failed to refresh Google token:', error)
      throw new Error('Failed to refresh access token')
    }
  }

  const oauth2Client = new google.auth.OAuth2()
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: connection.refreshToken || undefined,
  })

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

  try {
    // Fetch events from last 30 days and next 90 days
    const timeMin = new Date()
    timeMin.setDate(timeMin.getDate() - 30)
    const timeMax = new Date()
    timeMax.setDate(timeMax.getDate() + 90)

    let allEvents: any[] = []
    let nextPageToken: string | undefined

    do {
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        maxResults: 2500,
        singleEvents: true,
        orderBy: 'startTime',
        pageToken: nextPageToken,
      })

      if (response.data.items) {
        allEvents = allEvents.concat(response.data.items)
      }
      nextPageToken = response.data.nextPageToken || undefined
    } while (nextPageToken)

    console.log(`Found ${allEvents.length} events to sync for Google Calendar connection ${connectionId}`)

    // Initialize pgvector client
    const vectorClient = new PgVectorClient(connection.accountId || connection.userId)
    await vectorClient.initialize()

    let processedCount = 0
    for (const event of allEvents) {
      try {
        const content = [
          event.summary || 'No title',
          event.description || '',
          event.location || '',
          event.attendees?.map((a: any) => a.email).join(', ') || '',
          event.organizer?.email || '',
          event.start?.dateTime || event.start?.date || '',
          event.end?.dateTime || event.end?.date || '',
        ].filter(Boolean).join('\n')

        const embeddings = await getEmbeddings(content.substring(0, 8000))

        await db.syncedItem.upsert({
          where: {
            connectionId_externalId: {
              connectionId,
              externalId: event.id!,
            },
          },
          update: {
            title: event.summary || 'Untitled Event',
            content,
            url: event.htmlLink || undefined,
            modifiedAt: event.updated ? new Date(event.updated) : undefined,
            embeddings,
            indexedAt: new Date(),
          },
          create: {
            connectionId,
            externalId: event.id!,
            itemType: 'event',
            title: event.summary || 'Untitled Event',
            content,
            url: event.htmlLink || undefined,
            modifiedAt: event.updated ? new Date(event.updated) : undefined,
            embeddings,
            indexedAt: new Date(),
          },
        })

        // Index in Orama
        await vectorClient.insert({
          subject: event.summary || 'Untitled Event',
          body: content,
          rowBody: content,
          from: connection.userId,
          to: [],
          sentAt: event.start?.dateTime || event.start?.date || new Date().toISOString(),
          threadId: event.id!,
          source: 'google_calendar',
          sourceId: event.id!,
          fileName: event.summary || 'Untitled Event',
          embeddings,
        } as any)

        processedCount++
      } catch (error) {
        console.error(`Error syncing event ${event.id}:`, error)
      }
    }

    await db.appConnection.update({
      where: { id: connectionId },
      data: {
        lastSyncedAt: new Date(),
        syncStatus: 'synced',
        syncError: null,
      },
    })

    console.log(`Successfully synced ${processedCount} events for Google Calendar connection ${connectionId}`)
  } catch (error) {
    console.error(`Error syncing Google Calendar connection ${connectionId}:`, error)
    await db.appConnection.update({
      where: { id: connectionId },
      data: {
        syncStatus: 'error',
        syncError: error instanceof Error ? error.message : 'Unknown error',
      },
    })
    throw error
  }
}

