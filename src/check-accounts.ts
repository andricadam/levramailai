import { PrismaClient } from "../generated/prisma";

// Create Prisma client directly to avoid env validation issues
const prisma = new PrismaClient();

// Script to check current accounts and help restore the account switcher
async function checkAccounts() {
    console.log("🔍 Checking database for accounts...\n");
    
    try {
        // Get all users first
        const users = await prisma.user.findMany({
            select: {
                id: true,
                emailAddress: true,
                firstName: true,
                lastName: true,
                accounts: {
                    select: {
                        id: true,
                        emailAddress: true,
                        name: true,
                        nextDeltaToken: true,
                    }
                }
            }
        });

        if (users.length === 0) {
            console.log("❌ No users found in database.");
            console.log("💡 Make sure you're signed in with Clerk first.\n");
            return;
        }

        console.log(`Found ${users.length} user(s) in database:\n`);
        
        for (const user of users) {
            console.log(`👤 User: ${user.firstName} ${user.lastName} (${user.emailAddress})`);
            console.log(`   Clerk ID: ${user.id}`);
            console.log(`   Accounts: ${user.accounts.length}\n`);
            
            if (user.accounts.length === 0) {
                console.log("   ⚠️  This user has NO accounts!");
                console.log("   💡 The account switcher won't appear until you add at least 1 account.\n");
                console.log("   📋 To add accounts:");
                console.log("      1. Go to your mail UI at /mail");
                console.log("      2. You should see an 'Add account' button");
                console.log("      3. Click it to connect a Google account via Aurinko");
                console.log("      4. Repeat to add a second account\n");
            } else {
                console.log(`   📧 Accounts for this user:\n`);
                for (const account of user.accounts) {
                    console.log(`      • ${account.emailAddress} (${account.name})`);
                    console.log(`        ID: ${account.id}`);
                    if (account.nextDeltaToken) {
                        console.log(`        ✅ Has nextDeltaToken`);
                    } else {
                        console.log(`        ❌ No nextDeltaToken`);
                    }
                    console.log("");
                }
                
                if (user.accounts.length === 1) {
                    console.log("   ⚠️  Only 1 account found.");
                    console.log("   💡 The account switcher should be visible, but you need 2+ accounts to switch between them.");
                    console.log("   📋 To add another account:");
                    console.log("      1. Click on the account switcher dropdown");
                    console.log("      2. Click 'Add account' at the bottom of the dropdown");
                    console.log("      3. Connect another Google account\n");
                } else {
                    console.log(`   ✅ ${user.accounts.length} accounts found - account switcher should be working!\n`);
                }
            }
        }

    } catch (error) {
        console.error("❌ Error:", error);
    } finally {
        await prisma.$disconnect();
    }
}

// Run the script
checkAccounts()
    .then(() => {
        console.log("✅ Done!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Error:", error);
        process.exit(1);
    });

