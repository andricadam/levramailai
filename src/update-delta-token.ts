import { PrismaClient } from "../generated/prisma";

// Script to manually update nextDeltaToken for an account
// Usage: npx tsx src/update-delta-token.ts <accountId> <deltaToken>

const prisma = new PrismaClient();

async function updateDeltaToken() {
    const accountId = process.argv[2];
    const deltaToken = process.argv[3];

    if (!accountId || !deltaToken) {
        console.log("❌ Usage: npx tsx src/update-delta-token.ts <accountId> <deltaToken>");
        console.log("\nExample:");
        console.log("  npx tsx src/update-delta-token.ts 160408 'your-token-here'");
        console.log("\nTo find your account IDs, run:");
        console.log("  npx tsx src/playground.ts");
        process.exit(1);
    }

    try {
        const account = await prisma.account.findUnique({
            where: { id: accountId },
            select: {
                emailAddress: true,
                name: true,
                nextDeltaToken: true,
            }
        });

        if (!account) {
            console.log(`❌ Account with ID ${accountId} not found.`);
            process.exit(1);
        }

        console.log(`📧 Updating account: ${account.emailAddress} (${account.name})`);
        console.log(`   Current nextDeltaToken: ${account.nextDeltaToken || 'null'}`);
        console.log(`   New nextDeltaToken: ${deltaToken}\n`);

        await prisma.account.update({
            where: { id: accountId },
            data: { nextDeltaToken: deltaToken }
        });

        console.log("✅ Successfully updated nextDeltaToken!");
    } catch (error) {
        console.error("❌ Error:", error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

updateDeltaToken();

