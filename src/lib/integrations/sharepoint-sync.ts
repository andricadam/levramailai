import axios from 'axios'
import { db } from '@/server/db'
import { getEmbeddings } from '@/lib/embedding'
import { PgVectorClient } from '@/lib/pgvector'
import { MicrosoftOAuth } from './microsoft-oauth'

export async function syncSharePoint(connectionId: string) {
  const connection = await db.appConnection.findUnique({
    where: { id: connectionId },
    include: { user: true }
  })

  if (!connection || connection.appType !== 'sharepoint') {
    throw new Error('Invalid connection')
  }

  // Check if token needs refresh
  let accessToken = connection.accessToken
  if (connection.expiresAt && connection.expiresAt < new Date() && connection.refreshToken) {
    try {
      const oauth = new MicrosoftOAuth()
      const credentials = await oauth.refreshToken(connection.refreshToken)
      accessToken = credentials.access_token
      
      await db.appConnection.update({
        where: { id: connectionId },
        data: {
          accessToken: credentials.access_token,
          refreshToken: credentials.refresh_token || connection.refreshToken,
          expiresAt: credentials.expires_in 
            ? new Date(Date.now() + credentials.expires_in * 1000)
            : undefined,
        },
      })
    } catch (error) {
      console.error('Failed to refresh Microsoft token:', error)
      throw new Error('Failed to refresh access token')
    }
  }

  try {
    // Get SharePoint sites
    const sitesResponse = await axios.get(
      'https://graph.microsoft.com/v1.0/sites?search=*&$top=100',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    const sites = sitesResponse.data.value || []
    console.log(`Found ${sites.length} SharePoint sites for connection ${connectionId}`)

    // Initialize Orama
    const vectorClient = new PgVectorClient(connection.accountId || connection.userId)
    await vectorClient.initialize()

    let processedCount = 0

    for (const site of sites.slice(0, 10)) { // Limit to 10 sites
      try {
        // Get drive (document library) from site
        const driveResponse = await axios.get(
          `https://graph.microsoft.com/v1.0/sites/${site.id}/drive`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        )

        const driveId = driveResponse.data.id

        // Get items from drive
        let allItems: any[] = []
        let nextLink: string | undefined = `https://graph.microsoft.com/v1.0/sites/${site.id}/drive/root/children`

        do {
          const itemsResponse = await axios.get(nextLink, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          })

          if (itemsResponse.data.value) {
            allItems = allItems.concat(itemsResponse.data.value)
          }
          nextLink = itemsResponse.data['@odata.nextLink']
        } while (nextLink && allItems.length < 200) // Limit total items

        // Process files
        for (const item of allItems) {
          if (item.file) {
            try {
              // Skip large files
              if (item.size && item.size > 10 * 1024 * 1024) { // 10MB limit
                console.log(`Skipping large file: ${item.name} (${item.size} bytes)`)
                continue
              }

              // Download file content
              let content = ''
              try {
                const contentResponse = await axios.get(
                  `https://graph.microsoft.com/v1.0/sites/${site.id}/drive/items/${item.id}/content`,
                  {
                    headers: {
                      Authorization: `Bearer ${accessToken}`,
                    },
                    responseType: 'text',
                    timeout: 30000, // 30 second timeout
                  }
                )
                content = contentResponse.data
              } catch (contentError) {
                console.error(`Failed to download content for ${item.name}:`, contentError)
                // Use file name as content if download fails
                content = item.name
              }

              const contentForEmbedding = content.substring(0, 8000)
              const embeddings = await getEmbeddings(contentForEmbedding)

              await db.syncedItem.upsert({
                where: {
                  connectionId_externalId: {
                    connectionId,
                    externalId: item.id,
                  },
                },
                update: {
                  title: item.name,
                  content: content.substring(0, 50000),
                  url: item.webUrl,
                  mimeType: item.file.mimeType,
                  size: item.size,
                  modifiedAt: item.lastModifiedDateTime ? new Date(item.lastModifiedDateTime) : undefined,
                  embeddings,
                  indexedAt: new Date(),
                },
                create: {
                  connectionId,
                  externalId: item.id,
                  itemType: 'file',
                  title: item.name,
                  content: content.substring(0, 50000),
                  url: item.webUrl,
                  mimeType: item.file.mimeType,
                  size: item.size,
                  modifiedAt: item.lastModifiedDateTime ? new Date(item.lastModifiedDateTime) : undefined,
                  embeddings,
                  indexedAt: new Date(),
                },
              })

              // Index in Orama
              await vectorClient.insert({
                subject: item.name,
                body: content.substring(0, 5000),
                rowBody: content.substring(0, 5000),
                from: connection.userId,
                to: [],
                sentAt: item.lastModifiedDateTime || new Date().toISOString(),
                threadId: item.id,
                source: 'sharepoint',
                sourceId: item.id,
                fileName: item.name,
                embeddings,
              } as any)

              processedCount++
            } catch (error) {
              console.error(`Error syncing SharePoint item ${item.id}:`, error)
            }
          }
        }
      } catch (error) {
        console.error(`Error syncing SharePoint site ${site.id}:`, error)
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

    console.log(`Successfully synced ${processedCount} items for SharePoint connection ${connectionId}`)
  } catch (error) {
    console.error(`Error syncing SharePoint connection ${connectionId}:`, error)
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

