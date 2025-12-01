import axios from 'axios'
import type { EmailMessage, EmailAddress, EmailAttachment } from '@/types'
import { syncEmailsToDatabase } from '@/lib/sync-emails'
import { db } from '@/server/db'

interface GraphProfile {
  mail: string
  userPrincipalName: string
  displayName: string
  id: string
}

interface GraphMessage {
  id: string
  conversationId: string
  createdDateTime: string
  lastModifiedDateTime: string
  receivedDateTime: string
  sentDateTime: string
  subject: string
  body: {
    contentType: 'text' | 'html'
    content: string
  }
  bodyPreview: string
  from: {
    emailAddress: {
      name: string
      address: string
    }
  }
  toRecipients: Array<{
    emailAddress: {
      name: string
      address: string
    }
  }>
  ccRecipients?: Array<{
    emailAddress: {
      name: string
      address: string
    }
  }>
  bccRecipients?: Array<{
    emailAddress: {
      name: string
      address: string
    }
  }>
  replyTo?: Array<{
    emailAddress: {
      name: string
      address: string
    }
  }>
  flag?: {
    flagStatus: string
    importance: string
  }
  importance: 'low' | 'normal' | 'high'
  isRead: boolean
  hasAttachments: boolean
  internetMessageId?: string
  inReplyTo?: string
  parentFolderId?: string
  webLink?: string
}

interface GraphMessageListResponse {
  value: GraphMessage[]
  '@odata.nextLink'?: string
  '@odata.deltaLink'?: string
}

export class MicrosoftGraphAPI {
  private accessToken: string
  private baseUrl = 'https://graph.microsoft.com/v1.0'
  private onTokenRefresh?: () => Promise<string> // Callback to refresh token on 401
  private tokenRefreshAttempted = false // Track if we've already tried refreshing

  constructor(accessToken: string, onTokenRefresh?: () => Promise<string>) {
    this.accessToken = accessToken
    this.onTokenRefresh = onTokenRefresh
  }

  private async request<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.baseUrl}${endpoint}`)
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        // URL encode the value, especially important for $filter
        url.searchParams.append(key, value)
      })
    }

    try {
      const response = await axios.get<T>(url.toString(), {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      })

      // Reset token refresh flag on successful request
      this.tokenRefreshAttempted = false
      return response.data
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // Handle 401 Unauthorized - try to refresh token
        if (error.response?.status === 401 && this.onTokenRefresh && !this.tokenRefreshAttempted) {
          try {
            console.log('Token expired, attempting to refresh...')
            this.tokenRefreshAttempted = true
            const newToken = await this.onTokenRefresh()
            this.accessToken = newToken
            console.log('Token refreshed successfully, retrying request...')
            // Retry the request with the new token
            const response = await axios.get<T>(url.toString(), {
              headers: {
                Authorization: `Bearer ${this.accessToken}`,
              },
            })
            this.tokenRefreshAttempted = false
            return response.data
          } catch (refreshError) {
            console.error('Failed to refresh token:', refreshError)
            this.tokenRefreshAttempted = false
            // Fall through to throw the original 401 error
          }
        }
        
        console.error('Microsoft Graph API error:', {
          url: url.toString(),
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
        })
      }
      throw error
    }
  }

  private async postRequest<T>(endpoint: string, data: any): Promise<T> {
    try {
      const response = await axios.post<T>(`${this.baseUrl}${endpoint}`, data, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      })

      // Reset token refresh flag on successful request
      this.tokenRefreshAttempted = false
      return response.data
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // Handle 401 Unauthorized - try to refresh token
        if (error.response?.status === 401 && this.onTokenRefresh && !this.tokenRefreshAttempted) {
          try {
            console.log('Token expired, attempting to refresh...')
            this.tokenRefreshAttempted = true
            const newToken = await this.onTokenRefresh()
            this.accessToken = newToken
            console.log('Token refreshed successfully, retrying request...')
            // Retry the request with the new token
            const response = await axios.post<T>(`${this.baseUrl}${endpoint}`, data, {
              headers: {
                Authorization: `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json',
              },
            })
            this.tokenRefreshAttempted = false
            return response.data
          } catch (refreshError) {
            console.error('Failed to refresh token:', refreshError)
            this.tokenRefreshAttempted = false
            // Fall through to throw the original 401 error
          }
        }
      }
      throw error
    }
  }

  private async patchRequest<T>(endpoint: string, data: any): Promise<T> {
    try {
      const response = await axios.patch<T>(`${this.baseUrl}${endpoint}`, data, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      })

      // Reset token refresh flag on successful request
      this.tokenRefreshAttempted = false
      return response.data
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // Handle 401 Unauthorized - try to refresh token
        if (error.response?.status === 401 && this.onTokenRefresh && !this.tokenRefreshAttempted) {
          try {
            console.log('Token expired, attempting to refresh...')
            this.tokenRefreshAttempted = true
            const newToken = await this.onTokenRefresh()
            this.accessToken = newToken
            console.log('Token refreshed successfully, retrying request...')
            // Retry the request with the new token
            const response = await axios.patch<T>(`${this.baseUrl}${endpoint}`, data, {
              headers: {
                Authorization: `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json',
              },
            })
            this.tokenRefreshAttempted = false
            return response.data
          } catch (refreshError) {
            console.error('Failed to refresh token:', refreshError)
            this.tokenRefreshAttempted = false
            // Fall through to throw the original 401 error
          }
        }
      }
      throw error
    }
  }

  async getProfile(): Promise<{ emailAddress: string; name: string }> {
    const profile = await this.request<GraphProfile>('/me')
    return {
      emailAddress: profile.mail || profile.userPrincipalName,
      name: profile.displayName || profile.mail || profile.userPrincipalName,
    }
  }

  private mapFolderToSysLabels(folderId?: string, isRead?: boolean, importance?: string): EmailMessage['sysLabels'] {
    const sysLabels: EmailMessage['sysLabels'] = []
    
    // Default to inbox if no specific folder
    if (!folderId || folderId.includes('Inbox')) {
      sysLabels.push('inbox')
    } else if (folderId.includes('SentItems')) {
      sysLabels.push('sent')
    } else if (folderId.includes('Drafts')) {
      sysLabels.push('draft')
    } else if (folderId.includes('JunkEmail')) {
      sysLabels.push('junk')
    } else if (folderId.includes('DeletedItems')) {
      sysLabels.push('trash')
    } else {
      sysLabels.push('inbox')
    }

    if (!isRead) sysLabels.push('unread')
    if (importance === 'high') sysLabels.push('important')
    
    return sysLabels
  }

  private parseEmailAddress(graphAddress: { name: string; address: string }): EmailAddress {
    return {
      name: graphAddress.name || undefined,
      address: graphAddress.address.toLowerCase(),
      raw: graphAddress.name ? `${graphAddress.name} <${graphAddress.address}>` : graphAddress.address,
    }
  }

  private async getMessageDetails(messageId: string): Promise<EmailMessage> {
    const message = await this.request<GraphMessage>(`/me/messages/${messageId}`)

    const from = this.parseEmailAddress(message.from.emailAddress)
    const to = message.toRecipients.map(addr => this.parseEmailAddress(addr.emailAddress))
    const cc = message.ccRecipients?.map(addr => this.parseEmailAddress(addr.emailAddress)) || []
    const bcc = message.bccRecipients?.map(addr => this.parseEmailAddress(addr.emailAddress)) || []
    const replyTo = message.replyTo?.map(addr => this.parseEmailAddress(addr.emailAddress)) || []

    const sysLabels = this.mapFolderToSysLabels(
      message.parentFolderId,
      message.isRead,
      message.importance
    )

    // Get attachments if any
    const attachments: EmailAttachment[] = []
    if (message.hasAttachments) {
      try {
        const attachmentsResponse = await this.request<{ value: Array<{
          id: string
          name: string
          contentType: string
          size: number
          isInline: boolean
          contentId?: string
        }> }>(`/me/messages/${messageId}/attachments`)
        
        attachments.push(...attachmentsResponse.value.map(att => ({
          id: att.id,
          name: att.name,
          mimeType: att.contentType,
          size: att.size,
          inline: att.isInline || false,
          contentId: att.contentId,
        })))
      } catch (error) {
        console.warn('Could not fetch attachments:', error)
      }
    }

    return {
      id: message.id,
      threadId: message.conversationId,
      createdTime: message.createdDateTime,
      lastModifiedTime: message.lastModifiedDateTime,
      sentAt: message.sentDateTime,
      receivedAt: message.receivedDateTime,
      internetMessageId: message.internetMessageId || message.id,
      subject: message.subject || '(No subject)',
      sysLabels,
      keywords: [],
      sysClassifications: [],
      sensitivity: 'normal',
      meetingMessageMethod: undefined,
      from,
      to,
      cc,
      bcc,
      replyTo,
      hasAttachments: attachments.length > 0,
      body: message.body.contentType === 'html' ? message.body.content : undefined,
      bodySnippet: message.bodyPreview || undefined,
      attachments,
      inReplyTo: message.inReplyTo || undefined,
      references: undefined,
      internetHeaders: [],
      nativeProperties: {},
      folderId: message.parentFolderId,
      omitted: [],
    }
  }

  async listMessages(
    folderId?: string,
    deltaToken?: string,
    pageToken?: string,
    maxResults = 50,
    dateFilter?: string
  ): Promise<{
    messages: EmailMessage[]
    nextPageToken?: string
    nextDeltaToken?: string
  }> {
    let response: GraphMessageListResponse

    // If pageToken is a full URL (from @odata.nextLink), use it directly
    if (pageToken && pageToken.startsWith('http')) {
      // Make a direct request to the nextLink URL
      try {
        const axiosResponse = await axios.get<GraphMessageListResponse>(pageToken, {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        })
        this.tokenRefreshAttempted = false
        response = axiosResponse.data
      } catch (error) {
        if (axios.isAxiosError(error)) {
          // Handle 401 Unauthorized - try to refresh token
          if (error.response?.status === 401 && this.onTokenRefresh && !this.tokenRefreshAttempted) {
            try {
              console.log('Token expired, attempting to refresh...')
              this.tokenRefreshAttempted = true
              const newToken = await this.onTokenRefresh()
              this.accessToken = newToken
              console.log('Token refreshed successfully, retrying request...')
              // Retry the request with the new token
              const axiosResponse = await axios.get<GraphMessageListResponse>(pageToken, {
                headers: {
                  Authorization: `Bearer ${this.accessToken}`,
                },
              })
              this.tokenRefreshAttempted = false
              response = axiosResponse.data
            } catch (refreshError) {
              console.error('Failed to refresh token:', refreshError)
              this.tokenRefreshAttempted = false
              // Fall through to throw the original 401 error
            }
          } else {
            console.error('Microsoft Graph API error (nextLink):', {
              url: pageToken,
              status: error.response?.status,
              statusText: error.response?.statusText,
              data: error.response?.data,
            })
            throw error
          }
        } else {
          throw error
        }
      }
    } else {
      // Build the endpoint and params normally
      let endpoint = '/me/messages'
      if (deltaToken) {
        // Delta queries don't support $filter
        endpoint = `/me/messages/delta?$deltatoken=${encodeURIComponent(deltaToken)}`
      } else if (folderId) {
        endpoint = `/me/mailFolders/${encodeURIComponent(folderId)}/messages`
      }

      const params: Record<string, string> = {
        $top: maxResults.toString(),
        $select: 'id,conversationId,subject,from,toRecipients,ccRecipients,bccRecipients,replyTo,sentDateTime,receivedDateTime,isRead,hasAttachments,importance,parentFolderId,internetMessageId,bodyPreview',
      }

      // Add date filter if provided (but not with delta queries)
      if (dateFilter && !deltaToken) {
        params.$filter = dateFilter
      }

      // Handle pagination with $skip (only if no filter and no delta token)
      if (pageToken && !dateFilter && !deltaToken && !pageToken.startsWith('http')) {
        const skip = parseInt(pageToken) || 0
        if (skip > 0) {
          params.$skip = skip.toString()
        }
      }

      response = await this.request<GraphMessageListResponse>(endpoint, params)
    }

    // Fetch full message details
    const messages = await Promise.all(
      response.value.map(msg => this.getMessageDetails(msg.id))
    )

    // For pagination, use the nextLink if available
    let nextPageToken: string | undefined
    if (response['@odata.nextLink']) {
      // Use the full nextLink URL for pagination
      nextPageToken = response['@odata.nextLink']
    } else if (!dateFilter && !deltaToken && pageToken && !pageToken.startsWith('http')) {
      // Fallback: calculate next skip value if no nextLink and we're using $skip pagination
      const currentSkip = parseInt(pageToken) || 0
      nextPageToken = (currentSkip + maxResults).toString()
    }

    return {
      messages,
      nextPageToken,
      nextDeltaToken: response['@odata.deltaLink']?.split('$deltatoken=')[1] || deltaToken,
    }
  }

  async performInitialSync(accountId: string): Promise<void> {
    try {
      console.log(`Starting Microsoft Graph initial sync for account ${accountId}`)
      
      // Get messages from Inbox folder (last 30 days)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      // Microsoft Graph expects ISO 8601 format for date filters
      const filter = `receivedDateTime ge ${thirtyDaysAgo.toISOString()}`
      
      console.log(`Microsoft Graph filter: ${filter}`)

      let allMessages: EmailMessage[] = []
      let nextPageToken: string | undefined
      let pageCount = 0

      // Use smaller page size to avoid rate limits
      const PAGE_SIZE = 50

      do {
        pageCount++
        console.log(`Fetching Microsoft Graph page ${pageCount}...`)
        const response = await this.listMessages('Inbox', undefined, nextPageToken, PAGE_SIZE, filter)
        console.log(`Page ${pageCount}: Found ${response.messages.length} messages`)
        allMessages = allMessages.concat(response.messages)
        nextPageToken = response.nextPageToken
        
        // Add a small delay between pages to avoid rate limits
        if (nextPageToken) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      } while (nextPageToken)

      console.log(`Fetched ${allMessages.length} emails from Microsoft Graph across ${pageCount} pages`)

      if (allMessages.length === 0) {
        console.warn(`No emails found for account ${accountId}. This might be normal if the account has no emails in the last 30 days.`)
      }

      // Sync to database
      await syncEmailsToDatabase(accountId, allMessages)
      console.log(`Synced ${allMessages.length} emails to database for account ${accountId}`)

      // Update account with delta token for future incremental syncs
      // Get a delta link by making a delta query without filter
      const lastResponse = await this.listMessages('Inbox', undefined, undefined, 1)
      await db.account.update({
        where: { id: accountId },
        data: { nextDeltaToken: lastResponse.nextDeltaToken },
      })

      console.log(`Successfully completed Microsoft Graph initial sync for account ${accountId}`)
    } catch (error) {
      console.error('Error during Microsoft Graph initial sync:', error)
      if (error instanceof Error) {
        console.error('Error message:', error.message)
        console.error('Error stack:', error.stack)
      }
      throw error
    }
  }

  async sendEmail(params: {
    from: EmailAddress
    to: EmailAddress[]
    subject: string
    body: string
    cc?: EmailAddress[]
    bcc?: EmailAddress[]
    replyTo?: EmailAddress[]
    inReplyTo?: string
    references?: string[]
  }): Promise<{ id: string }> {
    const message = {
      message: {
        subject: params.subject,
        body: {
          contentType: 'html' as const,
          content: params.body,
        },
        from: {
          emailAddress: {
            name: params.from.name,
            address: params.from.address,
          },
        },
        toRecipients: params.to.map(addr => ({
          emailAddress: {
            name: addr.name,
            address: addr.address,
          },
        })),
        ccRecipients: params.cc?.map(addr => ({
          emailAddress: {
            name: addr.name,
            address: addr.address,
          },
        })),
        bccRecipients: params.bcc?.map(addr => ({
          emailAddress: {
            name: addr.name,
            address: addr.address,
          },
        })),
        replyTo: params.replyTo?.map(addr => ({
          emailAddress: {
            name: addr.name,
            address: addr.address,
          },
        })),
        internetMessageHeaders: [
          ...(params.inReplyTo ? [{ name: 'In-Reply-To', value: params.inReplyTo }] : []),
          ...(params.references ? [{ name: 'References', value: params.references.join(' ') }] : []),
        ],
      },
      saveToSentItems: true,
    }

    const response = await this.postRequest<{ id: string }>('/me/sendMail', message)
    return { id: response.id || 'sent' }
  }

  /**
   * Get all messages in a conversation (thread)
   */
  private async getMessagesByConversationId(conversationId: string): Promise<GraphMessage[]> {
    const response = await this.request<GraphMessageListResponse>('/me/messages', {
      $filter: `conversationId eq '${conversationId}'`,
      $select: 'id,conversationId',
    })
    return response.value
  }

  /**
   * Get folder ID by well-known name (e.g., 'Archive', 'DeletedItems')
   * Microsoft Graph has well-known folder names that can be used directly
   */
  private async getFolderIdByName(folderName: string): Promise<string> {
    // Try well-known folder name first (these are standard folder names in Microsoft Graph)
    const wellKnownFolders: Record<string, string> = {
      'Archive': 'Archive',
      'DeletedItems': 'DeletedItems',
      'Inbox': 'Inbox',
      'SentItems': 'SentItems',
      'Drafts': 'Drafts',
      'JunkEmail': 'JunkEmail',
    }

    if (wellKnownFolders[folderName]) {
      try {
        // Try to get the folder by well-known name
        const folder = await this.request<{ id: string }>(`/me/mailFolders/${wellKnownFolders[folderName]}`)
        return folder.id
      } catch {
        // If that fails, fall back to searching
      }
    }

    // Fallback: search all folders
    const folders = await this.request<{ value: Array<{ id: string; displayName: string }> }>('/me/mailFolders')
    const folder = folders.value.find(f => f.displayName === folderName || f.id === folderName)
    if (!folder) {
      throw new Error(`Folder ${folderName} not found`)
    }
    return folder.id
  }

  /**
   * Archive a thread by moving all messages to Archive folder
   */
  async archiveThread(threadId: string): Promise<void> {
    // In Microsoft Graph, threadId is actually conversationId
    const messages = await this.getMessagesByConversationId(threadId)
    
    // Get Archive folder ID
    const archiveFolderId = await this.getFolderIdByName('Archive')

    // Move each message to Archive folder
    await Promise.all(
      messages.map(message =>
        this.postRequest(`/me/messages/${message.id}/move`, {
          destinationId: archiveFolderId,
        })
      )
    )
  }

  /**
   * Delete a thread by moving all messages to DeletedItems folder (maps to junk in our system)
   */
  async deleteThread(threadId: string): Promise<void> {
    // In Microsoft Graph, threadId is actually conversationId
    const messages = await this.getMessagesByConversationId(threadId)
    
    // Get DeletedItems folder ID
    const deletedItemsFolderId = await this.getFolderIdByName('DeletedItems')

    // Move each message to DeletedItems folder
    await Promise.all(
      messages.map(message =>
        this.postRequest(`/me/messages/${message.id}/move`, {
          destinationId: deletedItemsFolderId,
        })
      )
    )
  }

  /**
   * Mark a thread as unread by setting isRead to false for all messages
   */
  async markAsUnread(threadId: string): Promise<void> {
    // In Microsoft Graph, threadId is actually conversationId
    const messages = await this.getMessagesByConversationId(threadId)

    // Update each message to mark as unread
    await Promise.all(
      messages.map(message =>
        this.patchRequest(`/me/messages/${message.id}`, {
          isRead: false,
        })
      )
    )
  }
}
