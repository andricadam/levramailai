import { google } from 'googleapis'
import { db } from '@/server/db'
import { getEmbeddings } from '@/lib/embedding'
import { PgVectorClient } from '@/lib/pgvector'
import { GoogleOAuth } from './google-oauth'

export async function syncGoogleDrive(connectionId: string) {
  const connection = await db.appConnection.findUnique({
    where: { id: connectionId },
    include: { user: true }
  })

  if (!connection || connection.appType !== 'google_drive') {
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

  // Initialize Google Drive API
  const oauth2Client = new google.auth.OAuth2()
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: connection.refreshToken || undefined,
  })

  const drive = google.drive({ version: 'v3', auth: oauth2Client })

  try {
    // Fetch files (limit to documents, PDFs, and text files)
    let allFiles: any[] = []
    let nextPageToken: string | undefined

    do {
      const response = await drive.files.list({
        pageSize: 100,
        pageToken: nextPageToken,
        fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, webViewLink)',
        q: "trashed=false and (mimeType='application/vnd.google-apps.document' or mimeType='application/pdf' or mimeType='text/plain' or mimeType contains 'text/' or mimeType='application/vnd.google-apps.spreadsheet')",
      })

      if (response.data.files) {
        allFiles = allFiles.concat(response.data.files)
      }
      nextPageToken = response.data.nextPageToken || undefined
    } while (nextPageToken)

    console.log(`Found ${allFiles.length} files to sync for Google Drive connection ${connectionId}`)

    // Initialize Orama for this account
    const vectorClient = new PgVectorClient(connection.accountId || connection.userId)
    await vectorClient.initialize()

    // Process and index each file
    let processedCount = 0
    for (const file of allFiles.slice(0, 100)) { // Limit to 100 files per sync
      try {
        let content = ''
        
        // Handle Google Workspace files differently
        if (file.mimeType === 'application/vnd.google-apps.document') {
          // Export Google Docs as plain text
          const exportResponse = await drive.files.export({
            fileId: file.id!,
            mimeType: 'text/plain',
          }, { responseType: 'text' })
          content = exportResponse.data as string
        } else if (file.mimeType === 'application/vnd.google-apps.spreadsheet') {
          // Export Google Sheets as CSV
          const exportResponse = await drive.files.export({
            fileId: file.id!,
            mimeType: 'text/csv',
          }, { responseType: 'text' })
          content = exportResponse.data as string
        } else {
          // Download regular files
          const fileResponse = await drive.files.get({
            fileId: file.id!,
            alt: 'media',
          }, { responseType: 'text' })
          content = fileResponse.data as string
        }

        // Limit content size for embeddings
        const contentForEmbedding = content.substring(0, 8000)
        const embeddings = await getEmbeddings(contentForEmbedding)

        // Upsert synced item
        await db.syncedItem.upsert({
          where: {
            connectionId_externalId: {
              connectionId,
              externalId: file.id!,
            },
          },
          update: {
            title: file.name || 'Untitled',
            content: content.substring(0, 50000), // Store more content in DB
            url: file.webViewLink || undefined,
            mimeType: file.mimeType || undefined,
            modifiedAt: file.modifiedTime ? new Date(file.modifiedTime) : undefined,
            embeddings,
            indexedAt: new Date(),
          },
          create: {
            connectionId,
            externalId: file.id!,
            itemType: 'file',
            title: file.name || 'Untitled',
            content: content.substring(0, 50000),
            url: file.webViewLink || undefined,
            mimeType: file.mimeType || undefined,
            modifiedAt: file.modifiedTime ? new Date(file.modifiedTime) : undefined,
            embeddings,
            indexedAt: new Date(),
          },
        })

        // Index in Orama
        await vectorClient.insert({
          subject: file.name || 'Untitled',
          body: content.substring(0, 5000),
          rowBody: content.substring(0, 5000),
          from: connection.userId,
          to: [],
          sentAt: file.modifiedTime || new Date().toISOString(),
          threadId: file.id!,
          source: 'google_drive',
          sourceId: file.id!,
          fileName: file.name || 'Untitled',
          embeddings,
        } as any)

        processedCount++
      } catch (error) {
        console.error(`Error syncing file ${file.id}:`, error)
        // Continue with next file
      }
    }

    // Update connection sync status
    await db.appConnection.update({
      where: { id: connectionId },
      data: {
        lastSyncedAt: new Date(),
        syncStatus: 'synced',
        syncError: null,
      },
    })

    console.log(`Successfully synced ${processedCount} files for Google Drive connection ${connectionId}`)
  } catch (error) {
    console.error(`Error syncing Google Drive connection ${connectionId}:`, error)
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

