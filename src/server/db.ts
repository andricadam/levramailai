import { env } from "@/env";
import { PrismaClient } from "../../generated/prisma";

const createPrismaClient = () =>
  new PrismaClient({
    log:
      env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
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
