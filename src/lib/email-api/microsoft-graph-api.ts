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

  constructor(accessToken: string) {
    this.accessToken = accessToken
  }

  private async request<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.baseUrl}${endpoint}`)
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value)
      })
    }

    const response = await axios.get<T>(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    })

    return response.data
  }

  private async postRequest<T>(endpoint: string, data: any): Promise<T> {
    const response = await axios.post<T>(`${this.baseUrl}${endpoint}`, data, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    return response.data
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
    maxResults = 50
  ): Promise<{
    messages: EmailMessage[]
    nextPageToken?: string
    nextDeltaToken?: string
  }> {
    let endpoint = '/me/messages'
    if (deltaToken) {
      endpoint = `/me/messages/delta?$deltatoken=${deltaToken}`
    } else if (folderId) {
      endpoint = `/me/mailFolders/${folderId}/messages`
    }

    const params: Record<string, string> = {
      $top: maxResults.toString(),
      $select: 'id,conversationId,subject,from,toRecipients,ccRecipients,bccRecipients,replyTo,sentDateTime,receivedDateTime,isRead,hasAttachments,importance,parentFolderId,internetMessageId,inReplyTo,bodyPreview',
    }

    if (pageToken) {
      // Microsoft Graph uses $skip or continuation tokens
      // For simplicity, we'll use $skip based on page number
      const skip = parseInt(pageToken) || 0
      params.$skip = skip.toString()
    }

    const response = await this.request<GraphMessageListResponse>(endpoint, params)

    // Fetch full message details
    const messages = await Promise.all(
      response.value.map(msg => this.getMessageDetails(msg.id))
    )

    return {
      messages,
      nextPageToken: response['@odata.nextLink'] ? (parseInt(pageToken || '0') + maxResults).toString() : undefined,
      nextDeltaToken: response['@odata.deltaLink']?.split('$deltatoken=')[1] || deltaToken,
    }
  }

  async performInitialSync(accountId: string): Promise<void> {
    try {
      // Get messages from Inbox folder (last 30 days)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const filter = `receivedDateTime ge ${thirtyDaysAgo.toISOString()}`

      let allMessages: EmailMessage[] = []
      let nextPageToken: string | undefined = '0'

      do {
        const response = await this.listMessages('Inbox', undefined, nextPageToken, 100)
        allMessages = allMessages.concat(response.messages)
        nextPageToken = response.nextPageToken
      } while (nextPageToken)

      console.log(`Fetched ${allMessages.length} emails from Microsoft Graph`)

      // Sync to database
      await syncEmailsToDatabase(accountId, allMessages)

      // Update account with delta token for future incremental syncs
      // We'll get the delta token from the last request
      const lastResponse = await this.listMessages('Inbox', undefined, nextPageToken, 1)
      await db.account.update({
        where: { id: accountId },
        data: { nextDeltaToken: lastResponse.nextDeltaToken },
      })

      console.log(`Successfully synced ${allMessages.length} emails for account ${accountId}`)
    } catch (error) {
      console.error('Error during Microsoft Graph initial sync:', error)
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
}
