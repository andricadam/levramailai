-- CreateEnum
CREATE TYPE "EmailPriority" AS ENUM ('high', 'medium', 'low');

-- AlterTable
ALTER TABLE "Email" ADD COLUMN     "priority" "EmailPriority" NOT NULL DEFAULT 'medium';

-- CreateIndex
CREATE INDEX "Email_priority_idx" ON "Email"("priority");

