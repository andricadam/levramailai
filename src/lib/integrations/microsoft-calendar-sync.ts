import axios from 'axios'
import { db } from '@/server/db'
import { getEmbeddings } from '@/lib/embedding'
import { PgVectorClient } from '@/lib/pgvector'
import { MicrosoftEmailOAuth } from '../email-oauth/microsoft-email-oauth'

interface GraphCalendarEvent {
  id: string
  subject: string
  body?: {
    contentType: 'text' | 'html'
    content: string
  }
  location?: {
    displayName: string
  }
  start: {
    dateTime: string
    timeZone: string
  }
  end: {
    dateTime: string
    timeZone: string
  }
  organizer?: {
    emailAddress: {
      address: string
      name: string
    }
  }
  attendees?: Array<{
    emailAddress: {
      address: string
      name: string
    }
  }>
  webLink?: string
  lastModifiedDateTime?: string
}

interface GraphCalendarViewResponse {
  value: GraphCalendarEvent[]
  '@odata.nextLink'?: string
}

export async function syncMicrosoftCalendar(connectionId: string) {
  const connection = await db.appConnection.findUnique({
    where: { id: connectionId },
    include: { user: true }
  })

  if (!connection || connection.appType !== 'microsoft_calendar') {
    throw new Error('Invalid connection')
  }

  // Check if token needs refresh
  let accessToken = connection.accessToken
  if (connection.expiresAt && connection.expiresAt < new Date() && connection.refreshToken) {
    try {
      const oauth = new MicrosoftEmailOAuth()
      const credentials = await oauth.refreshToken(connection.refreshToken)
      accessToken = credentials.access_token!
      
      await db.appConnection.update({
        where: { id: connectionId },
        data: {
          accessToken: credentials.access_token!,
          refreshToken: credentials.refresh_token || connection.refreshToken,
          expiresAt: credentials.expiry_date || undefined,
        },
      })
    } catch (error) {
      console.error('Failed to refresh Microsoft token:', error)
      throw new Error('Failed to refresh access token')
    }
  }

  const baseUrl = 'https://graph.microsoft.com/v1.0'

  try {
    // Fetch events from last 30 days and next 90 days
    const timeMin = new Date()
    timeMin.setDate(timeMin.getDate() - 30)
    const timeMax = new Date()
    timeMax.setDate(timeMax.getDate() + 90)

    let allEvents: GraphCalendarEvent[] = []
    let nextLink: string | undefined

    do {
      const requestUrl = nextLink || 
        `${baseUrl}/me/calendar/calendarView?startDateTime=${timeMin.toISOString()}&endDateTime=${timeMax.toISOString()}&$top=1000&$orderby=start/dateTime`
      
      const response = await axios.get<GraphCalendarViewResponse>(requestUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
      
      if (response.data.value) {
        allEvents = allEvents.concat(response.data.value)
      }
      nextLink = response.data['@odata.nextLink']
    } while (nextLink)

    console.log(`Found ${allEvents.length} events to sync for Microsoft Calendar connection ${connectionId}`)

    // Initialize Orama
    const vectorClient = new PgVectorClient(connection.accountId || connection.userId)
    await vectorClient.initialize()

    let processedCount = 0
    for (const event of allEvents) {
      try {
        const content = [
          event.subject || 'No title',
          event.body?.content || '',
          event.location?.displayName || '',
          event.attendees?.map((a) => a.emailAddress?.address).filter(Boolean).join(', ') || '',
          event.organizer?.emailAddress?.address || '',
          event.start?.dateTime || '',
          event.end?.dateTime || '',
        ].filter(Boolean).join('\n')

        const embeddings = await getEmbeddings(content.substring(0, 8000))

        await db.syncedItem.upsert({
          where: {
            connectionId_externalId: {
              connectionId,
              externalId: event.id,
            },
          },
          update: {
            title: event.subject || 'Untitled Event',
            content,
            url: event.webLink || undefined,
            modifiedAt: event.lastModifiedDateTime ? new Date(event.lastModifiedDateTime) : undefined,
            embeddings,
            indexedAt: new Date(),
          },
          create: {
            connectionId,
            externalId: event.id,
            itemType: 'event',
            title: event.subject || 'Untitled Event',
            content,
            url: event.webLink || undefined,
            modifiedAt: event.lastModifiedDateTime ? new Date(event.lastModifiedDateTime) : undefined,
            embeddings,
            indexedAt: new Date(),
          },
        })

        // Index in Orama
        await vectorClient.insert({
          subject: event.subject || 'Untitled Event',
          body: content,
          rowBody: content,
          from: connection.userId,
          to: [],
          sentAt: event.start?.dateTime || new Date().toISOString(),
          threadId: event.id,
          source: 'microsoft_calendar',
          sourceId: event.id,
          fileName: event.subject || 'Untitled Event',
          embeddings,
        } as any)

        processedCount++
      } catch (error) {
        console.error(`Error processing event ${event.id}:`, error)
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

    console.log(`Successfully synced ${processedCount} events for Microsoft Calendar connection ${connectionId}`)
  } catch (error) {
    console.error(`Error syncing Microsoft Calendar connection ${connectionId}:`, error)
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

/**
 * Create a new event in Microsoft Calendar
 */
export async function createMicrosoftCalendarEvent(
  connectionId: string,
  title: string,
  startDateTime: string,
  endDateTime: string,
  description?: string,
  location?: string
) {
  const connection = await db.appConnection.findUnique({
    where: { id: connectionId },
    include: { user: true }
  })

  if (!connection || connection.appType !== 'microsoft_calendar') {
    throw new Error('Invalid connection')
  }

  // Check if token needs refresh
  let accessToken = connection.accessToken
  if (connection.expiresAt && connection.expiresAt < new Date() && connection.refreshToken) {
    try {
      const oauth = new MicrosoftEmailOAuth()
      const credentials = await oauth.refreshToken(connection.refreshToken)
      accessToken = credentials.access_token!
      
      await db.appConnection.update({
        where: { id: connectionId },
        data: {
          accessToken: credentials.access_token!,
          refreshToken: credentials.refresh_token || connection.refreshToken,
          expiresAt: credentials.expiry_date || undefined,
        },
      })
    } catch (error) {
      console.error('Failed to refresh Microsoft token:', error)
      throw new Error('Failed to refresh access token')
    }
  }

  const baseUrl = 'https://graph.microsoft.com/v1.0'

  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

    // Create the event
    const eventData = {
      subject: title,
      body: {
        contentType: 'text' as const,
        content: description || '',
      },
      start: {
        dateTime: startDateTime,
        timeZone: timeZone,
      },
      end: {
        dateTime: endDateTime,
        timeZone: timeZone,
      },
      location: location ? {
        displayName: location,
      } : undefined,
    }

    const response = await axios.post<GraphCalendarEvent>(
      `${baseUrl}/me/calendar/events`,
      eventData,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    const createdEvent = response.data

    if (!createdEvent.id) {
      throw new Error('Failed to create event: no ID returned')
    }

    // Sync the created event to database
    const content = [
      createdEvent.subject || title,
      createdEvent.body?.content || description || '',
      createdEvent.location?.displayName || location || '',
      createdEvent.attendees?.map((a) => a.emailAddress?.address).filter(Boolean).join(', ') || '',
      createdEvent.organizer?.emailAddress?.address || '',
      createdEvent.start?.dateTime || startDateTime,
      createdEvent.end?.dateTime || endDateTime,
    ].filter(Boolean).join('\n')

    const embeddings = await getEmbeddings(content.substring(0, 8000))

    // Initialize Orama
    const vectorClient = new PgVectorClient(connection.accountId || connection.userId)
    await vectorClient.initialize()

    await db.syncedItem.upsert({
      where: {
        connectionId_externalId: {
          connectionId,
          externalId: createdEvent.id,
        },
      },
      update: {
        title: createdEvent.subject || title,
        content,
        url: createdEvent.webLink || undefined,
        modifiedAt: createdEvent.lastModifiedDateTime ? new Date(createdEvent.lastModifiedDateTime) : new Date(),
        embeddings,
        indexedAt: new Date(),
      },
      create: {
        connectionId,
        externalId: createdEvent.id,
        itemType: 'event',
        title: createdEvent.subject || title,
        content,
        url: createdEvent.webLink || undefined,
        modifiedAt: createdEvent.lastModifiedDateTime ? new Date(createdEvent.lastModifiedDateTime) : new Date(),
        embeddings,
        indexedAt: new Date(),
      },
    })

    // Index in Orama
    await vectorClient.insert({
      subject: createdEvent.subject || title,
      body: content,
      rowBody: content,
      from: connection.userId,
      to: [],
      sentAt: createdEvent.start?.dateTime || startDateTime,
      threadId: createdEvent.id,
      source: 'microsoft_calendar',
      sourceId: createdEvent.id,
      fileName: createdEvent.subject || title,
      embeddings,
    } as any)

    return {
      id: createdEvent.id,
      externalId: createdEvent.id,
      connectionId,
    }
  } catch (error) {
    console.error(`Error creating Microsoft Calendar event:`, error)
    throw error
  }
}

