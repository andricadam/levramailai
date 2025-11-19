import { PrismaClient } from "../generated/prisma";
import { Account } from "./lib/acount";
import { syncEmailsToDatabase } from "./lib/sync-to-db";

// Script to clean all emails and trigger a new sync
// Usage: npx tsx src/clean-and-sync.ts <accountId>

const prisma = new PrismaClient();

async function cleanAndSync() {
    const accountId = process.argv[2];

    if (!accountId) {
        console.log("❌ Usage: npx tsx src/clean-and-sync.ts <accountId>");
        console.log("\nExample:");
        console.log("  npx tsx src/clean-and-sync.ts 160408");
        console.log("\nTo find your account IDs, run:");
        console.log("  npx tsx src/playground.ts");
        process.exit(1);
    }

    try {
        // Get the account
        const account = await prisma.account.findUnique({
            where: { id: accountId },
            select: {
                id: true,
                emailAddress: true,
                name: true,
                accessToken: true,
                nextDeltaToken: true,
            }
        });

        if (!account) {
            console.log(`❌ Account with ID ${accountId} not found.`);
            process.exit(1);
        }

        console.log(`📧 Account: ${account.emailAddress} (${account.name})`);
        console.log(`   Current nextDeltaToken: ${account.nextDeltaToken || 'null'}\n`);

        // Step 1: Delete all related data
        console.log("🧹 Cleaning up existing emails, threads, and related data...\n");

        // Get all thread IDs for this account first
        const threads = await prisma.thread.findMany({
            where: { accountId: accountId },
            select: { id: true }
        });
        const threadIds = threads.map(t => t.id);

        if (threadIds.length > 0) {
            // Delete in correct order due to foreign key constraints
            // 1. Delete email attachments (depends on Email)
            const deletedAttachments = await prisma.emailAttachment.deleteMany({
                where: {
                    email: {
                        threadId: { in: threadIds }
                    }
                }
            });
            console.log(`   ✅ Deleted ${deletedAttachments.count} email attachments`);

            // 2. Delete emails (depends on Thread)
            const deletedEmails = await prisma.email.deleteMany({
                where: {
                    threadId: { in: threadIds }
                }
            });
            console.log(`   ✅ Deleted ${deletedEmails.count} emails`);
        } else {
            console.log(`   ℹ️  No threads found to delete`);
        }

        // 3. Delete threads (depends on Account)
        const deletedThreads = await prisma.thread.deleteMany({
            where: {
                accountId: accountId
            }
        });
        console.log(`   ✅ Deleted ${deletedThreads.count} threads`);

        // 4. Delete email addresses (depends on Account)
        // Note: This is safe because we've already deleted all emails that reference them
        const deletedEmailAddresses = await prisma.emailAddress.deleteMany({
            where: {
                accountId: accountId
            }
        });
        console.log(`   ✅ Deleted ${deletedEmailAddresses.count} email addresses`);

        // 5. Clear the nextDeltaToken to force a fresh sync
        await prisma.account.update({
            where: { id: accountId },
            data: { nextDeltaToken: null }
        });
        console.log(`   ✅ Cleared nextDeltaToken\n`);

        console.log("✨ Cleanup complete!\n");

        // Step 2: Trigger new sync
        console.log("🔄 Starting new initial sync...\n");

        const accountInstance = new Account(account.accessToken);
        const response = await accountInstance.performInitialSync();

        if (!response) {
            console.error("❌ Failed to perform initial sync");
            process.exit(1);
        }

        const { emails, deltaToken } = response;

        console.log(`\n📊 Sync Results:`);
        console.log(`   ✅ Synced ${emails.length} emails`);
        console.log(`   🔑 Delta Token: ${deltaToken}\n`);

        // Step 3: Save emails to database
        console.log("💾 Saving emails to database...\n");
        await syncEmailsToDatabase(emails, accountId);

        // Step 4: Save delta token
        await prisma.account.update({
            where: { id: accountId },
            data: { nextDeltaToken: deltaToken }
        });

        console.log("\n✅ Successfully completed!");
        console.log(`   - Cleaned all existing data`);
        console.log(`   - Synced ${emails.length} new emails`);
        console.log(`   - Saved nextDeltaToken: ${deltaToken}`);

    } catch (error) {
        console.error("❌ Error:", error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

cleanAndSync();

