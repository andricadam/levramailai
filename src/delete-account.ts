import { PrismaClient } from "../generated/prisma";

// Script to delete an account and all its related data
// Usage: npx tsx src/delete-account.ts <accountId>

const prisma = new PrismaClient();

async function deleteAccount() {
    const accountId = process.argv[2];

    if (!accountId) {
        console.log("❌ Usage: npx tsx src/delete-account.ts <accountId>");
        console.log("\nExample:");
        console.log("  npx tsx src/delete-account.ts 160408");
        process.exit(1);
    }

    try {
        // Get the account first to show what we're deleting
        const account = await prisma.account.findUnique({
            where: { id: accountId },
            select: {
                id: true,
                emailAddress: true,
                name: true,
            }
        });

        if (!account) {
            console.log(`❌ Account with ID ${accountId} not found.`);
            process.exit(1);
        }

        console.log(`📧 Account to delete: ${account.emailAddress} (${account.name})`);
        console.log(`   ID: ${account.id}\n`);

        // Get counts before deletion
        const threads = await prisma.thread.findMany({
            where: { accountId: accountId },
            select: { id: true }
        });
        const threadIds = threads.map(t => t.id);

        let emailCount = 0;
        let attachmentCount = 0;
        if (threadIds.length > 0) {
            emailCount = await prisma.email.count({
                where: { threadId: { in: threadIds } }
            });
            attachmentCount = await prisma.emailAttachment.count({
                where: {
                    email: {
                        threadId: { in: threadIds }
                    }
                }
            });
        }

        const emailAddressCount = await prisma.emailAddress.count({
            where: { accountId: accountId }
        });

        console.log(`📊 Data to be deleted:`);
        console.log(`   - ${threads.length} threads`);
        console.log(`   - ${emailCount} emails`);
        console.log(`   - ${attachmentCount} attachments`);
        console.log(`   - ${emailAddressCount} email addresses`);
        console.log(`   - 1 account\n`);

        // Delete in correct order due to foreign key constraints
        if (threadIds.length > 0) {
            // 1. Delete email attachments
            const deletedAttachments = await prisma.emailAttachment.deleteMany({
                where: {
                    email: {
                        threadId: { in: threadIds }
                    }
                }
            });
            console.log(`   ✅ Deleted ${deletedAttachments.count} email attachments`);

            // 2. Delete emails
            const deletedEmails = await prisma.email.deleteMany({
                where: {
                    threadId: { in: threadIds }
                }
            });
            console.log(`   ✅ Deleted ${deletedEmails.count} emails`);
        }

        // 3. Delete threads
        const deletedThreads = await prisma.thread.deleteMany({
            where: {
                accountId: accountId
            }
        });
        console.log(`   ✅ Deleted ${deletedThreads.count} threads`);

        // 4. Delete email addresses
        const deletedEmailAddresses = await prisma.emailAddress.deleteMany({
            where: {
                accountId: accountId
            }
        });
        console.log(`   ✅ Deleted ${deletedEmailAddresses.count} email addresses`);

        // 5. Delete the account
        await prisma.account.delete({
            where: { id: accountId }
        });
        console.log(`   ✅ Deleted account\n`);

        console.log("✅ Successfully deleted account and all related data!");

    } catch (error) {
        console.error("❌ Error:", error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

deleteAccount();

