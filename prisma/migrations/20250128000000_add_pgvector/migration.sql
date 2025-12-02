-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embeddings column to Email table as Float[] (Prisma doesn't support vector type directly)
-- We'll cast to vector in SQL queries
ALTER TABLE "Email" ADD COLUMN IF NOT EXISTS "embeddings" DOUBLE PRECISION[];

-- Create vector index for efficient similarity search
-- Using HNSW index for better performance on large datasets
-- Cast to vector type for indexing
CREATE INDEX IF NOT EXISTS "Email_embeddings_idx" ON "Email" 
USING hnsw ((embeddings::vector(1536)) vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Create index for ChatAttachment embeddings (cast to vector)
CREATE INDEX IF NOT EXISTS "ChatAttachment_textEmbeddings_idx" ON "ChatAttachment" 
USING hnsw ((text_embeddings::vector(1536)) vector_cosine_ops)
WITH (m = 16, ef_construction = 64)
WHERE text_embeddings IS NOT NULL AND array_length(text_embeddings, 1) = 1536;

-- Create index for SyncedItem embeddings (cast to vector)
CREATE INDEX IF NOT EXISTS "SyncedItem_embeddings_idx" ON "SyncedItem" 
USING hnsw ((embeddings::vector(1536)) vector_cosine_ops)
WITH (m = 16, ef_construction = 64)
WHERE embeddings IS NOT NULL AND array_length(embeddings, 1) = 1536;
