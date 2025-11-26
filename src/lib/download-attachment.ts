import axios from 'axios'
import { db } from '@/server/db'
import { processFile, MAX_FILE_SIZE } from './file-processor'
import { getCachedAttachment, cacheAttachment } from './attachment-cache'

/**
 * Rate limiting for concurrent attachment downloads
 * Limits to 3 concurrent downloads per account to avoid overwhelming the API
 */
class RateLimiter {
  private activeDownloads = new Map<string, number>()
  private readonly MAX_CONCURRENT = 3

  async acquire(accountId: string): Promise<() => void> {
    // Wait if we're at the limit
    while ((this.activeDownloads.get(accountId) || 0) >= this.MAX_CONCURRENT) {
      await new Promise(resolve => setTimeout(resolve, 100)) // Wait 100ms and retry
    }

    // Increment counter
    this.activeDownloads.set(accountId, (this.activeDownloads.get(accountId) || 0) + 1)

    // Return release function
    return () => {
      const current = this.activeDownloads.get(accountId) || 0
      if (current <= 1) {
        this.activeDownloads.delete(accountId)
      } else {
        this.activeDownloads.set(accountId, current - 1)
      }
    }
  }
}

const rateLimiter = new RateLimiter()

/**
 * Download and process email attachment on-demand
 * Returns processed attachment data (text, embeddings) for RAG context
 * 
 * Features:
 * - Checks cache first to avoid re-downloading
 * - Rate limits concurrent downloads
 * - Validates file size (10MB limit)
 * - Handles errors gracefully
 */
export async function downloadAndProcessAttachment(
  attachmentId: string,
  emailId: string,
  accountId: string,
  userId: string
): Promise<{
  fileName: string
  mimeType: string
  text: string
  embeddings: number[]
} | null> {
  try {
    // Check cache first
    const cached = getCachedAttachment(attachmentId)
    if (cached) {
      console.log(`Using cached attachment: ${attachmentId}`)
      return {
        fileName: cached.fileName,
        mimeType: cached.mimeType,
        text: cached.text,
        embeddings: cached.embeddings
      }
    }

    // Verify attachment belongs to user's account
    const attachment = await db.emailAttachment.findFirst({
      where: {
        id: attachmentId,
        Email: {
          id: emailId,
          thread: {
            accountId,
            account: {
              userId
            }
          }
        }
      },
      include: {
        Email: {
          include: {
            thread: {
              include: {
                account: true
              }
            }
          }
        }
      }
    })

    if (!attachment) {
      console.error(`Attachment not found or access denied: ${attachmentId}`)
      return null
    }

    // Validate file size before downloading
    if (attachment.size > MAX_FILE_SIZE) {
      console.warn(`Attachment ${attachmentId} exceeds size limit: ${attachment.size} bytes`)
      return null
    }

    // Check if content is already in DB (from sync)
    let buffer: Buffer | null = null
    
    if (attachment.content) {
      // Content already available, decode from base64
      try {
        buffer = Buffer.from(attachment.content, 'base64')
        
        // Validate size again after decoding
        if (buffer.length > MAX_FILE_SIZE) {
          console.warn(`Decoded attachment ${attachmentId} exceeds size limit: ${buffer.length} bytes`)
          return null
        }
      } catch (error) {
        console.error(`Failed to decode attachment content: ${attachmentId}`, error)
        // Continue to download from API
      }
    }

    // If not in DB, download from Aurinko API
    if (!buffer) {
      const account = attachment.Email.thread.account
      const accessToken = account.accessToken

      // Acquire rate limit slot
      const release = await rateLimiter.acquire(accountId)
      
      try {
        console.log(`Downloading attachment ${attachmentId} from Aurinko API`)
        
        // Download attachment from Aurinko
        const response = await axios.get(
          `https://api.aurinko.io/v1/email/messages/${emailId}/attachments/${attachmentId}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`
            },
            responseType: 'arraybuffer', // Get binary data
            maxContentLength: MAX_FILE_SIZE, // Prevent downloading files larger than limit
            timeout: 30000 // 30 second timeout
          }
        )

        buffer = Buffer.from(response.data)
        
        // Validate downloaded size
        if (buffer.length > MAX_FILE_SIZE) {
          console.warn(`Downloaded attachment ${attachmentId} exceeds size limit: ${buffer.length} bytes`)
          return null
        }

        // Optionally: Cache the content in DB for future use (but don't index it)
        // This saves API calls if user asks about same attachment again
        try {
          await db.emailAttachment.update({
            where: { id: attachmentId },
            data: {
              content: buffer.toString('base64') // Store for future use
            }
          })
        } catch (dbError) {
          // Don't fail if DB update fails, just log it
          console.error(`Failed to cache attachment content in DB: ${attachmentId}`, dbError)
        }
      } catch (downloadError) {
        console.error(`Failed to download attachment ${attachmentId}:`, downloadError)
        return null
      } finally {
        // Always release rate limit slot
        release()
      }
    }

    // Process the attachment
    try {
      const processed = await processFile(buffer, attachment.name, attachment.mimeType)

      // Cache the processed result
      cacheAttachment(
        attachmentId,
        processed.text,
        processed.embeddings,
        attachment.name,
        attachment.mimeType
      )

      return {
        fileName: attachment.name,
        mimeType: attachment.mimeType,
        text: processed.text,
        embeddings: processed.embeddings
      }
    } catch (processError) {
      console.error(`Failed to process attachment ${attachmentId}:`, processError)
      return null
    }
  } catch (error) {
    console.error(`Error in downloadAndProcessAttachment for ${attachmentId}:`, error)
    return null
  }
}

/**
 * Batch download and process multiple attachments with rate limiting
 * Returns array of successfully processed attachments
 */
export async function downloadAndProcessAttachments(
  attachments: Array<{
    attachmentId: string
    emailId: string
    accountId: string
    userId: string
  }>,
  maxAttachments: number = 5 // Limit to 5 attachments per email
): Promise<Array<{
  fileName: string
  mimeType: string
  text: string
  embeddings: number[]
}>> {
  // Limit number of attachments to process
  const limited = attachments.slice(0, maxAttachments)
  
  // Process in parallel (rate limiting is handled internally)
  const results = await Promise.all(
    limited.map(att =>
      downloadAndProcessAttachment(
        att.attachmentId,
        att.emailId,
        att.accountId,
        att.userId
      )
    )
  )

  // Filter out null results (failed downloads)
  return results.filter((result): result is NonNullable<typeof result> => result !== null)
}

