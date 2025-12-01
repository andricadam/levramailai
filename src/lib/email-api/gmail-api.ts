import axios from 'axios'
import type { EmailMessage, EmailAddress, EmailAttachment } from '@/types'
import { syncEmailsToDatabase } from '@/lib/sync-emails'
import { db } from '@/server/db'

/**
 * Rate limiter to throttle Gmail API requests
 * Gmail allows ~250 quota units per user per second
 * - List messages: 5 units
 * - Get message: 5 units
 * - Profile: 1 unit
 * We'll be very conservative: 1 request per 200ms = 5 requests/second max
 * This is a singleton to coordinate across all GmailAPI instances
 */
class GmailRateLimiter {
  private static instance: GmailRateLimiter
  private queue: Array<() => void> = []
  private processing = false
  private readonly minDelayMs = 200 // Minimum 200ms between requests (5 req/sec max - very conservative)
  private lastRequestTime = 0

  static getInstance(): GmailRateLimiter {
    if (!GmailRateLimiter.instance) {
      GmailRateLimiter.instance = new GmailRateLimiter()
    }
    return GmailRateLimiter.instance
  }

  async throttle<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn()
          resolve(result)
        } catch (error) {
          reject(error)
        }
      })
      this.processQueue()
    })
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) return
    
    this.processing = true
    
    while (this.queue.length > 0) {
      const now = Date.now()
      const timeSinceLastRequest = now - this.lastRequestTime
      
      if (timeSinceLastRequest < this.minDelayMs) {
        await new Promise(resolve => setTimeout(resolve, this.minDelayMs - timeSinceLastRequest))
      }
      
      const task = this.queue.shift()
      if (task) {
        this.lastRequestTime = Date.now()
        await task()
      }
    }
    
    this.processing = false
  }
}

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
  private rateLimiter = GmailRateLimiter.getInstance() // Use singleton to coordinate across all instances
  private onTokenRefresh?: () => Promise<string> // Callback to refresh token on 401

  constructor(accessToken: string, onTokenRefresh?: () => Promise<string>) {
    this.accessToken = accessToken
    this.onTokenRefresh = onTokenRefresh
  }

  private async request<T>(endpoint: string, params?: Record<string, string>, retries = 4): Promise<T> {
    const url = new URL(`${this.baseUrl}${endpoint}`)
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value)
      })
    }

    return this.rateLimiter.throttle(async () => {
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const response = await axios.get<T>(url.toString(), {
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
            },
          })

          return response.data
        } catch (error) {
          if (axios.isAxiosError(error)) {
            if (error.response?.status === 429) {
              // Rate limit exceeded - parse retry-after header or use exponential backoff
              let retryAfterSeconds: number
              
              // Try to get retry-after from header (in seconds)
              const retryAfterHeader = error.response.headers['retry-after']
              if (retryAfterHeader) {
                retryAfterSeconds = parseInt(retryAfterHeader)
              } else {
                // Try to parse from error message
                const errorData = error.response.data
                const errorMessage = errorData?.error?.message || ''
                
                if (errorMessage.includes('Retry after')) {
                  retryAfterSeconds = this.parseRetryAfterFromMessage(errorMessage)
                } else {
                  // Exponential backoff with jitter: 2s, 4s, 8s, 16s, 32s
                  retryAfterSeconds = Math.pow(2, attempt) + Math.random()
                }
              }
              
              // Don't cap retry delay - respect Gmail's retry-after time fully
              // But add a maximum of 300 seconds (5 minutes) to prevent infinite waits
              retryAfterSeconds = Math.min(retryAfterSeconds, 300)
              
              if (attempt < retries) {
                console.warn(`Gmail API rate limit hit on ${endpoint}. Retrying after ${retryAfterSeconds.toFixed(1)}s (attempt ${attempt + 1}/${retries + 1})...`)
                // Wait the full retry time before attempting again
                await new Promise(resolve => setTimeout(resolve, retryAfterSeconds * 1000))
                continue
              } else {
                // All retries exhausted - throw a more informative error
                console.error(`Gmail API rate limit exceeded after ${retries + 1} attempts on ${endpoint}. Please wait ${retryAfterSeconds} seconds before trying again.`)
                const rateLimitError = new Error(`Gmail API rate limit exceeded. Please try again in ${Math.ceil(retryAfterSeconds)} seconds.`)
                ;(rateLimitError as any).status = 429
                ;(rateLimitError as any).retryAfter = retryAfterSeconds
                throw rateLimitError
              }
            } else if (error.response?.status === 403) {
              // Forbidden - likely token issue or insufficient permissions
              console.error('Gmail API 403 Forbidden error:', {
                url: url.toString(),
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data,
                errorMessage: error.response.data?.error?.message,
                errorReason: error.response.data?.error?.errors?.[0]?.reason,
              })
              // Don't retry 403 errors - they indicate a permission/scope issue
              throw error
            } else if (error.response?.status === 401) {
              // Unauthorized - token expired or invalid
              // Try to refresh token if callback is provided
              if (this.onTokenRefresh && attempt === 0) {
                try {
                  console.log('Token expired, attempting to refresh...')
                  const newToken = await this.onTokenRefresh()
                  this.accessToken = newToken
                  console.log('Token refreshed successfully, retrying request...')
                  // Retry the request with the new token
                  continue
                } catch (refreshError) {
                  console.error('Failed to refresh token:', refreshError)
                  // Fall through to throw the original 401 error
                }
              }
              
              console.error('Gmail API 401 Unauthorized error:', {
                url: url.toString(),
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data,
              })
              // Don't retry 401 errors if refresh failed or no refresh callback
              throw error
            }
          }
          throw error
        }
      }
      
      throw new Error('Max retries exceeded')
    })
  }

  private async postRequest<T>(endpoint: string, data: any, retries = 4): Promise<T> {
    return this.rateLimiter.throttle(async () => {
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const response = await axios.post<T>(`${this.baseUrl}${endpoint}`, data, {
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
              'Content-Type': 'application/json',
            },
          })

          return response.data
        } catch (error) {
          if (axios.isAxiosError(error)) {
            if (error.response?.status === 429) {
              // Rate limit exceeded
              let retryAfterSeconds: number
              
              // Try to get retry-after from header (in seconds)
              const retryAfterHeader = error.response.headers['retry-after']
              if (retryAfterHeader) {
                retryAfterSeconds = parseInt(retryAfterHeader)
              } else {
                // Try to parse from error message
                const errorData = error.response.data
                const errorMessage = errorData?.error?.message || 
                                     errorData?.error?.errors?.[0]?.message || 
                                     ''
                
                if (errorMessage.includes('Retry after')) {
                  retryAfterSeconds = this.parseRetryAfterFromMessage(errorMessage)
                } else {
                  // Exponential backoff with jitter: 2s, 4s, 8s, 16s, 32s
                  retryAfterSeconds = Math.pow(2, attempt) + Math.random()
                }
              }
              
              // Don't cap retry delay - respect Gmail's retry-after time fully
              // But add a maximum of 300 seconds (5 minutes) to prevent infinite waits
              retryAfterSeconds = Math.min(retryAfterSeconds, 300)
              
              if (attempt < retries) {
                console.warn(`Gmail API rate limit hit on POST ${endpoint}. Retrying after ${retryAfterSeconds.toFixed(1)}s (attempt ${attempt + 1}/${retries + 1})...`)
                // Wait the full retry time before attempting again
                await new Promise(resolve => setTimeout(resolve, retryAfterSeconds * 1000))
                continue
              } else {
                // All retries exhausted - throw a more informative error
                console.error(`Gmail API rate limit exceeded after ${retries + 1} attempts on POST ${endpoint}. Please wait ${retryAfterSeconds} seconds before trying again.`)
                const rateLimitError = new Error(`Gmail API rate limit exceeded. Please try again in ${Math.ceil(retryAfterSeconds)} seconds.`)
                ;(rateLimitError as any).status = 429
                ;(rateLimitError as any).retryAfter = retryAfterSeconds
                throw rateLimitError
              }
            } else if (error.response?.status === 403) {
              // Forbidden - likely token issue or insufficient permissions
              console.error('Gmail API 403 Forbidden error:', {
                endpoint,
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data,
              })
              throw error
            } else if (error.response?.status === 401) {
              // Unauthorized - token expired or invalid
              // Try to refresh token if callback is provided
              if (this.onTokenRefresh && attempt === 0) {
                try {
                  console.log('Token expired, attempting to refresh...')
                  const newToken = await this.onTokenRefresh()
                  this.accessToken = newToken
                  console.log('Token refreshed successfully, retrying request...')
                  // Retry the request with the new token
                  continue
                } catch (refreshError) {
                  console.error('Failed to refresh token:', refreshError)
                  // Fall through to throw the original 401 error
                }
              }
              
              console.error('Gmail API 401 Unauthorized error:', {
                endpoint,
                status: error.response.status,
                statusText: error.response.statusText,
              })
              // Don't retry 401 errors if refresh failed or no refresh callback
              throw error
            }
          }
          throw error
        }
      }
      
      throw new Error('Max retries exceeded')
    })
  }

  private parseRetryAfterFromMessage(message: string): number {
    // Parse "Retry after 2025-12-01T13:51:52.950Z" format
    const match = message.match(/Retry after (.+)/)
    if (match) {
      const retryDate = new Date(match[1])
      const now = new Date()
      const waitSeconds = Math.ceil((retryDate.getTime() - now.getTime()) / 1000)
      return Math.max(waitSeconds, 1) // At least 1 second
    }
    return 2 // Default 2 seconds
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
    const params: Record<string, string> = {
      maxResults: maxResults.toString(),
    }
    
    if (query) {
      params.q = query
    }
    
    if (pageToken) {
      params.pageToken = pageToken
    }

    const listResponse = await this.request<{
      messages?: Array<{ id: string; threadId: string }>
      nextPageToken?: string
    }>('/users/me/messages', params)

    if (!listResponse.messages || listResponse.messages.length === 0) {
      return { messages: [], nextPageToken: listResponse.nextPageToken }
    }

    // Fetch full message details sequentially to avoid rate limits
    // Process messages one at a time with rate limiting built into the request method
    const messages: EmailMessage[] = []

    for (const msg of listResponse.messages) {
      try {
        const message = await this.getMessageDetails(msg.id)
        messages.push(message)
      } catch (error) {
        // If we hit rate limits, log and continue with what we have
        if (axios.isAxiosError(error) && error.response?.status === 429) {
          console.warn(`Rate limit hit while fetching message ${msg.id}. Stopping batch fetch.`)
          break
        }
        // For other errors, log and continue
        console.warn(`Error fetching message ${msg.id}:`, error)
      }
    }

    return {
      messages,
      nextPageToken: listResponse.nextPageToken,
      // Gmail uses historyId for delta sync, but we'll use nextPageToken for now
      nextDeltaToken: listResponse.nextPageToken,
    }
  }

  async performInitialSync(accountId: string): Promise<void> {
    try {
      console.log(`Starting Gmail initial sync for account ${accountId}`)
      
      // Use 'in:inbox' to fetch ALL inbox emails (including very new ones)
      // Removed 'after:' filter to ensure we capture emails immediately, even if they're very new
      const query = `in:inbox`
      
      console.log(`Gmail query: ${query} (fetching all inbox emails for immediate sync)`)

      let allMessages: EmailMessage[] = []
      let nextPageToken: string | undefined
      let pageCount = 0

      // Use smaller page size to avoid rate limits
      const PAGE_SIZE = 50

      do {
        pageCount++
        console.log(`Fetching Gmail page ${pageCount}...`)
        try {
          const response = await this.listMessages(query, nextPageToken, PAGE_SIZE)
          console.log(`Page ${pageCount}: Found ${response.messages.length} messages`)
          
          // Log first few message IDs and subjects for debugging
          if (pageCount === 1 && response.messages.length > 0) {
            const firstFew = response.messages.slice(0, 5)
            console.log(`Sample messages from page 1:`, firstFew.map(m => ({
              id: m.id,
              subject: m.subject,
              from: m.from.address,
              sentAt: m.sentAt
            })))
          }
          
          allMessages = allMessages.concat(response.messages)
          nextPageToken = response.nextPageToken
          
          // Add delay between pages to avoid rate limits (2 seconds between pages)
          if (nextPageToken) {
            await new Promise(resolve => setTimeout(resolve, 2000))
          }
        } catch (error) {
          // If we hit rate limits during pagination, stop and use what we have
          if (axios.isAxiosError(error) && error.response?.status === 429) {
            console.warn(`Rate limit hit during initial sync at page ${pageCount}. Stopping sync and using ${allMessages.length} emails fetched so far.`)
            break
          }
          // For other errors, throw to be handled by outer try-catch
          throw error
        }
      } while (nextPageToken)

      console.log(`Fetched ${allMessages.length} emails from Gmail across ${pageCount} pages`)

      if (allMessages.length === 0) {
        console.warn(`No emails found for account ${accountId}. This might be normal if the inbox is empty.`)
      } else {
        // Log summary of fetched emails
        const recentEmails = allMessages
          .filter(m => {
            const sentDate = new Date(m.sentAt)
            const oneDayAgo = new Date()
            oneDayAgo.setDate(oneDayAgo.getDate() - 1)
            return sentDate > oneDayAgo
          })
          .slice(0, 10)
        
        if (recentEmails.length > 0) {
          console.log(`Found ${recentEmails.length} emails from the last 24 hours:`, recentEmails.map(m => ({
            id: m.id,
            subject: m.subject,
            from: m.from.address,
            sentAt: m.sentAt
          })))
        }
      }

      // Sync to database
      await syncEmailsToDatabase(accountId, allMessages)
      console.log(`Synced ${allMessages.length} emails to database for account ${accountId}`)

      // Update account with historyId for future delta syncs
      const profile = await this.request<GmailProfile>('/users/me/profile')
      await db.account.update({
        where: { id: accountId },
        data: { nextDeltaToken: profile.historyId },
      })

      console.log(`Successfully completed Gmail initial sync for account ${accountId}`)
    } catch (error) {
      console.error('Error during Gmail initial sync:', error)
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

  /**
   * Archive a thread by removing the INBOX label
   */
  async archiveThread(threadId: string): Promise<void> {
    await this.postRequest(`/users/me/threads/${threadId}/modify`, {
      removeLabelIds: ['INBOX'],
    })
  }

  /**
   * Delete a thread by adding the TRASH label (maps to junk in our system)
   */
  async deleteThread(threadId: string): Promise<void> {
    await this.postRequest(`/users/me/threads/${threadId}/modify`, {
      addLabelIds: ['TRASH'],
    })
  }

  /**
   * Mark a thread as unread by adding the UNREAD label
   */
  async markAsUnread(threadId: string): Promise<void> {
    await this.postRequest(`/users/me/threads/${threadId}/modify`, {
      addLabelIds: ['UNREAD'],
    })
  }
}
