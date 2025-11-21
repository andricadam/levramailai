-- Step 1: Add id column as nullable
ALTER TABLE "ChatbotInteraction" ADD COLUMN IF NOT EXISTS "id" TEXT;

-- Step 2: Generate unique IDs for existing rows (using a cuid-like format)
-- Prisma cuid() generates IDs like "clxxx..." - we'll use a similar approach
UPDATE "ChatbotInteraction" 
SET "id" = 'cl' || substr(md5(random()::text || clock_timestamp()::text), 1, 24)
WHERE "id" IS NULL;

-- Step 3: Make id NOT NULL
ALTER TABLE "ChatbotInteraction" ALTER COLUMN "id" SET NOT NULL;

-- Step 4: Drop existing primary key if it exists (the table might have a composite PK on day+userId)
ALTER TABLE "ChatbotInteraction" DROP CONSTRAINT IF EXISTS "ChatbotInteraction_pkey";

-- Step 5: Set id as primary key
ALTER TABLE "ChatbotInteraction" ADD CONSTRAINT "ChatbotInteraction_pkey" PRIMARY KEY ("id");

