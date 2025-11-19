import { PrismaClient } from "../generated/prisma";

// Simple script to test database connection
const prisma = new PrismaClient();

async function testConnection() {
    console.log('🔍 Testing database connection...\n');
    
    try {
        // Try a simple query
        const result = await prisma.$queryRaw`SELECT 1 as test`;
        console.log('✅ Database connection successful!');
        console.log('   Result:', result);
        
        // Try to count accounts
        const accountCount = await prisma.account.count();
        console.log(`\n📊 Found ${accountCount} account(s) in database`);
        
        if (accountCount > 0) {
            const accounts = await prisma.account.findMany({
                select: {
                    id: true,
                    emailAddress: true,
                    userId: true,
                },
                take: 5
            });
            console.log('\n📧 Sample accounts:');
            accounts.forEach(acc => {
                console.log(`   - ${acc.emailAddress} (ID: ${acc.id}, UserID: ${acc.userId})`);
            });
        }
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('❌ Database connection failed!\n');
        console.error('Error:', errorMessage);
        
        if (errorMessage.includes("Can't reach database server")) {
            console.error('\n💡 This usually means:');
            console.error('   1. Supabase database is PAUSED (most common on free tier)');
            console.error('   2. Go to: https://supabase.com/dashboard');
            console.error('   3. Find your project and click "Resume" or "Restore"');
            console.error('   4. Wait 30-60 seconds for it to start');
            console.error('\n   OR');
            console.error('   5. Check your DATABASE_URL in .env file');
            console.error('   6. Make sure it\'s the correct connection string');
        }
    } finally {
        await prisma.$disconnect();
    }
}

testConnection();

