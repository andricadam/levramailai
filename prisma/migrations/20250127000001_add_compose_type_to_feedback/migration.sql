-- Add type and userPrompt fields to InstantReplyFeedback
ALTER TABLE "InstantReplyFeedback" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'instant-reply';
ALTER TABLE "InstantReplyFeedback" ADD COLUMN IF NOT EXISTS "userPrompt" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InstantReplyFeedback_type_idx" ON "InstantReplyFeedback"("type");

