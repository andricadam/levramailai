import { env } from "@/env";
import { PrismaClient } from "../../generated/prisma";

/**
 * Creates a Prisma client instance.
 * 
 * Note: Connection pool configuration is handled via DATABASE_URL.
 * For PostgreSQL, you can add connection pool parameters to the connection string:
 * - ?connection_limit=20&pool_timeout=20
 * 
 * If you're experiencing "Timed out fetching a new connection from the connection pool" errors:
 * 1. Increase connection_limit in your DATABASE_URL (e.g., ?connection_limit=20)
 * 2. Increase pool_timeout (e.g., ?pool_timeout=20)
 * 3. Check for long-running queries that might be holding connections
 * 4. Consider using a connection pooler (like PgBouncer) for production
 * 
 * Example DATABASE_URL with increased pool:
 * postgresql://user:pass@host:5432/db?connection_limit=20&pool_timeout=20
 */
const createPrismaClient = () =>
  new PrismaClient({
    log:
      env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    datasources: {
      db: {
        url: env.DATABASE_URL,
      },
    },
  });

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") globalForPrisma.prisma = db;

// Helper function to test database connection
export async function testDatabaseConnection() {
  try {
    await db.$queryRaw`SELECT 1`;
    return { connected: true, error: null };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { 
      connected: false, 
      error: errorMessage,
      suggestion: errorMessage.includes("Can't reach database server") 
        ? "Database server is unreachable. Check if Supabase database is paused or if DATABASE_URL is correct."
        : "Unknown database connection error"
    };
  }
}

/**
 * Retry a database operation with exponential backoff.
 * Useful for handling transient connection pool errors and statement timeouts.
 */
export async function retryDbOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 5,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | unknown;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: unknown) {
      lastError = error;
      
      // Check if it's a retryable error (connection pool, timeout, or transient errors)
      const isRetryableError = 
        error instanceof Error && (
          error.message.includes("connection pool") ||
          error.message.includes("Timed out fetching a new connection") ||
          error.message.includes("Can't reach database server") ||
          error.message.includes("P1001") ||
          error.message.includes("P2024") ||
          error.message.includes("statement timeout") ||
          error.message.includes("57014") ||
          error.message.includes("canceling statement due to statement timeout")
        );
      
      if (!isRetryableError || attempt === maxRetries - 1) {
        throw error;
      }
      
      // Exponential backoff: 1s, 2s, 4s, 8s, 16s
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`Database operation failed (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}
