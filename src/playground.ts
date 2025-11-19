import { PrismaClient } from "../generated/prisma";

// Create Prisma client directly to avoid env validation issues
const prisma = new PrismaClient();

// Script to help find the nextDeltaToken
async function findDeltaToken() {
    console.log("🔍 Checking database for accounts and nextDeltaToken...\n");
    
    try {
        const accounts = await prisma.account.findMany({
            select: {
                id: true,
                emailAddress: true,
                name: true,
                nextDeltaToken: true,
            }
        });

        if (accounts.length === 0) {
            console.log("❌ No accounts found in database.");
            return;
        }

        console.log(`Found ${accounts.length} account(s):\n`);
        
        for (const account of accounts) {
            console.log(`📧 Account: ${account.emailAddress} (${account.name})`);
            console.log(`   ID: ${account.id}`);
            if (account.nextDeltaToken) {
                console.log(`   ✅ nextDeltaToken: ${account.nextDeltaToken}`);
            } else {
                console.log(`   ❌ nextDeltaToken: null (not saved yet)`);
                console.log(`   💡 You need to find this token from your console logs.`);
            }
            console.log("");
        }

        // If no token found, provide instructions
        const accountsWithoutToken = accounts.filter(acc => !acc.nextDeltaToken);
        if (accountsWithoutToken.length > 0) {
            console.log("📋 To find your token from console logs:\n");
            console.log("1. Look in your terminal where you ran 'npm run dev'");
            console.log("2. Search for: 'sync completed'");
            console.log("3. The token will be on the same line, like:");
            console.log("   sync completed <your-token-here>\n");
            console.log("4. Or search your terminal history with:");
            console.log("   history | grep 'sync completed'\n");
            console.log("5. Once you find it, you can manually update the database or");
            console.log("   trigger a new initial sync (the token will be saved automatically now).\n");
        }
    } finally {
        await prisma.$disconnect();
    }
}

// Run the script
findDeltaToken()
    .then(() => {
        console.log("✅ Done!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Error:", error);
        process.exit(1);
    });