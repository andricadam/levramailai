/**
 * In-memory cache for processed email attachments
 * Clears after TTL expires or on server restart
 * Prevents re-downloading and re-processing the same attachments
 */

type CachedAttachment = {
  text: string
  embeddings: number[]
  timestamp: number
  fileName: string
  mimeType: string
}

const attachmentCache = new Map<string, CachedAttachment>()

// Cache TTL: 1 hour
const CACHE_TTL = 60 * 60 * 1000

/**
 * Get cached attachment data if available and not expired
 */
export function getCachedAttachment(attachmentId: string): CachedAttachment | null {
  const cached = attachmentCache.get(attachmentId)
  if (!cached) return null
  
  // Check if expired
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    attachmentCache.delete(attachmentId)
    return null
  }
  
  return cached
}

/**
 * Cache processed attachment data
 */
export function cacheAttachment(
  attachmentId: string,
  text: string,
  embeddings: number[],
  fileName: string,
  mimeType: string
) {
  attachmentCache.set(attachmentId, {
    text,
    embeddings,
    fileName,
    mimeType,
    timestamp: Date.now()
  })
}

/**
 * Remove attachment from cache (manual cleanup)
 */
export function removeCachedAttachment(attachmentId: string) {
  attachmentCache.delete(attachmentId)
}

/**
 * Cleanup expired entries
 * Should be called periodically
 */
export function cleanupExpiredAttachments() {
  const now = Date.now()
  let cleaned = 0
  
  for (const [id, data] of attachmentCache.entries()) {
    if (now - data.timestamp > CACHE_TTL) {
      attachmentCache.delete(id)
      cleaned++
    }
  }
  
  if (cleaned > 0) {
    console.log(`Cleaned up ${cleaned} expired attachment cache entries`)
  }
  
  return cleaned
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    size: attachmentCache.size,
    entries: Array.from(attachmentCache.keys())
  }
}

// Cleanup expired entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    cleanupExpiredAttachments()
  }, 5 * 60 * 1000) // Check every 5 minutes
}

