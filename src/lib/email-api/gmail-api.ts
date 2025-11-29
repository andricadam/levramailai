import axios from 'axios'
import type { EmailMessage, EmailAddress, EmailAttachment } from '@/types'
import { syncEmailsToDatabase } from '@/lib/sync-emails'
import { db } from '@/server/db'

interface GmailProfile {
  emailAddress: string
  messagesTotal: number
  threadsTotal: number
  historyId: string
}

interface GmailMessage {
  id: string
  threadId: string
  labelIds: string[]
  snippet: string
  historyId: string
  internalDate: string
  payload: {
    headers: Array<{ name: string; value: string }>
    body: {
      data?: string
      size: number
    }
    parts?: Array<{
      mimeType: string
      filename?: string
      body: { data?: string; size: number }
      headers?: Array<{ name: string; value: string }>
      parts?: Array<{
        mimeType: string
        filename?: string
        body: { data?: string; size: number }
      }>
    }>
  }
  sizeEstimate: number
}

export class GmailAPI {
  private accessToken: string
  private baseUrl = 'https://gmail.googleapis.com/gmail/v1'

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
    const profile = await this.request<GmailProfile>('/users/me/profile')
    
    // Get user info from Google People API (fallback to email if not available)
    let name = profile.emailAddress
    try {
      const userInfo = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      })
      name = userInfo.data.name || profile.emailAddress
    } catch (error) {
      console.warn('Could not fetch user name, using email:', error)
    }

    return {
      emailAddress: profile.emailAddress,
      name,
    }
  }

  private mapLabelIdsToSysLabels(labelIds: string[]): EmailMessage['sysLabels'] {
    const sysLabels: EmailMessage['sysLabels'] = []
    
    if (labelIds.includes('INBOX')) sysLabels.push('inbox')
    if (labelIds.includes('SENT')) sysLabels.push('sent')
    if (labelIds.includes('DRAFT')) sysLabels.push('draft')
    if (labelIds.includes('SPAM')) sysLabels.push('junk')
    if (labelIds.includes('TRASH')) sysLabels.push('trash')
    if (labelIds.includes('UNREAD')) sysLabels.push('unread')
    if (labelIds.includes('STARRED')) sysLabels.push('flagged')
    if (labelIds.includes('IMPORTANT')) sysLabels.push('important')
    
    return sysLabels.length > 0 ? sysLabels : ['inbox']
  }

  private parseEmailAddress(header: string): EmailAddress {
    // Parse "Name <email@example.com>" or "email@example.com"
    const match = header.match(/^(.*?)\s*<(.+?)>$|^(.+?)$/)
    if (match) {
      const name = match[1]?.trim() || match[3]?.trim() || ''
      const address = match[2] || match[3] || ''
      return {
        name: name && name !== address ? name : undefined,
        address: address.toLowerCase(),
        raw: header,
      }
    }
    return { address: header.toLowerCase(), raw: header }
  }

  private parseEmailAddresses(header: string): EmailAddress[] {
    if (!header) return []
    // Split by comma and parse each
    return header.split(',').map(addr => this.parseEmailAddress(addr.trim()))
  }

  private decodeBase64(data: string): string {
    try {
      return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')
    } catch {
      return ''
    }
  }

  private extractBody(parts: GmailMessage['payload']['parts'], mimeType = 'text/html'): string {
    if (!parts) return ''
    
    for (const part of parts) {
      if (part.mimeType === mimeType && part.body?.data) {
        return this.decodeBase64(part.body.data)
      }
      if (part.parts) {
        const body = this.extractBody(part.parts, mimeType)
        if (body) return body
      }
    }
    
    return ''
  }

  private async getMessageDetails(messageId: string): Promise<EmailMessage> {
    const message = await this.request<GmailMessage>(`/users/me/messages/${messageId}`, {
      format: 'full',
    })

    const headers = message.payload.headers.reduce((acc, h) => {
      acc[h.name.toLowerCase()] = h.value
      return acc
    }, {} as Record<string, string>)

    const subject = headers['subject'] || '(No subject)'
    const from = this.parseEmailAddress(headers['from'] || '')
    const to = this.parseEmailAddresses(headers['to'] || '')
    const cc = this.parseEmailAddresses(headers['cc'] || '')
    const bcc = this.parseEmailAddresses(headers['bcc'] || '')
    const replyTo = this.parseEmailAddresses(headers['reply-to'] || '')

    // Extract body
    let body = ''
    let bodySnippet = message.snippet || ''
    
    if (message.payload.body?.data) {
      body = this.decodeBase64(message.payload.body.data)
    } else if (message.payload.parts) {
      body = this.extractBody(message.payload.parts, 'text/html')
      if (!body) {
        body = this.extractBody(message.payload.parts, 'text/plain')
      }
    }

    // Extract attachments
    const attachments: EmailAttachment[] = []
    if (message.payload.parts) {
      for (const part of message.payload.parts) {
        if (part.filename && part.body?.size && part.body.size > 0) {
          attachments.push({
            id: `${messageId}_${part.filename}`,
            name: part.filename,
            mimeType: part.mimeType,
            size: part.body.size,
            inline: false,
          })
        }
        if (part.parts) {
          for (const subPart of part.parts) {
            if (subPart.filename && subPart.body?.size && subPart.body.size > 0) {
              attachments.push({
                id: `${messageId}_${subPart.filename}`,
                name: subPart.filename,
                mimeType: subPart.mimeType,
                size: subPart.body.size,
                inline: false,
              })
            }
          }
        }
      }
    }

    const sentAt = new Date(parseInt(message.internalDate)).toISOString()
    const sysLabels = this.mapLabelIdsToSysLabels(message.labelIds)

    return {
      id: message.id,
      threadId: message.threadId,
      createdTime: sentAt,
      lastModifiedTime: sentAt,
      sentAt,
      receivedAt: sentAt,
      internetMessageId: headers['message-id'] || message.id,
      subject,
      sysLabels,
      keywords: [],
      sysClassifications: [],
      sensitivity: 'normal',
      from,
      to,
      cc,
      bcc,
      replyTo,
      hasAttachments: attachments.length > 0,
      body: body || undefined,
      bodySnippet: bodySnippet || undefined,
      attachments,
      inReplyTo: headers['in-reply-to'] || undefined,
      references: headers['references'] || undefined,
      internetHeaders: Object.entries(headers).map(([name, value]) => ({ name, value })),
      nativeProperties: {},
      omitted: [],
    }
  }

  async listMessages(query?: string, pageToken?: string, maxResults = 50): Promise<{
    messages: EmailMessage[]
    nextPageToken?: string
    nextDeltaToken?: string
  }> {
    // First, list message IDs
    const listResponse = await this.request<{
      messages?: Array<{ id: string; threadId: string }>
      nextPageToken?: string
    }>('/users/me/messages', {
      q: query || '',
      maxResults: maxResults.toString(),
      pageToken: pageToken || '',
    })

    if (!listResponse.messages || listResponse.messages.length === 0) {
      return { messages: [], nextPageToken: listResponse.nextPageToken }
    }

    // Fetch full message details (batch requests)
    const messages = await Promise.all(
      listResponse.messages.map(msg => this.getMessageDetails(msg.id))
    )

    return {
      messages,
      nextPageToken: listResponse.nextPageToken,
      // Gmail uses historyId for delta sync, but we'll use nextPageToken for now
      nextDeltaToken: listResponse.nextPageToken,
    }
  }

  async performInitialSync(accountId: string): Promise<void> {
    try {
      // Get messages from last 30 days
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const query = `after:${Math.floor(thirtyDaysAgo.getTime() / 1000)}`

      let allMessages: EmailMessage[] = []
      let nextPageToken: string | undefined

      do {
        const response = await this.listMessages(query, nextPageToken, 100)
        allMessages = allMessages.concat(response.messages)
        nextPageToken = response.nextPageToken
      } while (nextPageToken)

      console.log(`Fetched ${allMessages.length} emails from Gmail`)

      // Sync to database
      await syncEmailsToDatabase(accountId, allMessages)

      // Update account with historyId for future delta syncs
      const profile = await this.request<GmailProfile>('/users/me/profile')
      await db.account.update({
        where: { id: accountId },
        data: { nextDeltaToken: profile.historyId },
      })

      console.log(`Successfully synced ${allMessages.length} emails for account ${accountId}`)
    } catch (error) {
      console.error('Error during Gmail initial sync:', error)
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
    // Build RFC 2822 email
    const to = params.to.map(addr => addr.name ? `${addr.name} <${addr.address}>` : addr.address).join(', ')
    const cc = params.cc?.map(addr => addr.name ? `${addr.name} <${addr.address}>` : addr.address).join(', ') || ''
    const bcc = params.bcc?.map(addr => addr.name ? `${addr.name} <${addr.address}>` : addr.address).join(', ') || ''
    const replyTo = params.replyTo?.map(addr => addr.name ? `${addr.name} <${addr.address}>` : addr.address).join(', ') || ''

    let headers = `From: ${params.from.name ? `${params.from.name} <${params.from.address}>` : params.from.address}\r\n`
    headers += `To: ${to}\r\n`
    if (cc) headers += `Cc: ${cc}\r\n`
    if (bcc) headers += `Bcc: ${bcc}\r\n`
    if (replyTo) headers += `Reply-To: ${replyTo}\r\n`
    headers += `Subject: ${params.subject}\r\n`
    if (params.inReplyTo) headers += `In-Reply-To: ${params.inReplyTo}\r\n`
    if (params.references) headers += `References: ${params.references.join(' ')}\r\n`
    headers += `Content-Type: text/html; charset=UTF-8\r\n\r\n`

    const email = headers + params.body
    const encodedEmail = Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

    const response = await this.postRequest<{ id: string }>('/users/me/messages/send', {
      raw: encodedEmail,
    })

    return response
  }
}
