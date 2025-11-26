-- CreateTable
CREATE TABLE IF NOT EXISTS "InstantReplyFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "threadId" TEXT,
    "emailContext" TEXT NOT NULL,
    "originalEmailId" TEXT,
    "generatedReply" TEXT NOT NULL,
    "finalSentReply" TEXT,
    "wasEdited" BOOLEAN NOT NULL DEFAULT false,
    "editSimilarity" DOUBLE PRECISION,
    "modelVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstantReplyFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InstantReplyFeedback_userId_accountId_idx" ON "InstantReplyFeedback"("userId", "accountId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InstantReplyFeedback_threadId_idx" ON "InstantReplyFeedback"("threadId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InstantReplyFeedback_createdAt_idx" ON "InstantReplyFeedback"("createdAt");

-- AddForeignKey
ALTER TABLE "InstantReplyFeedback" ADD CONSTRAINT "InstantReplyFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

