-- Add foreign key constraint for ChatbotInteraction.userId -> User.id
-- This ensures referential integrity between ChatbotInteraction and User tables
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'ChatbotInteraction_userId_fkey'
    ) THEN
        ALTER TABLE "ChatbotInteraction" 
        ADD CONSTRAINT "ChatbotInteraction_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

