import { PrismaClient } from "../generated/prisma";

// Test with direct connection (non-pooler) to see if pooler is the issue
// This helps diagnose if it's a pooler-specific problem

async function testDirectConnection() {
    console.log('🔍 Testing database connection diagnostics...\n');
    
    // Check if DATABASE_URL is set
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.error('❌ DATABASE_URL is not set in environment variables');
        return;
    }
    
    console.log('📋 DATABASE_URL format check:');
    const urlParts = dbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
    if (urlParts) {
        const [, user, , host, port, database] = urlParts;
        console.log(`   Host: ${host}`);
        console.log(`   Port: ${port}`);
        console.log(`   Database: ${database}`);
        console.log(`   User: ${user}`);
        
        // Check if it's using pooler
        if (host.includes('pooler')) {
            console.log('\n⚠️  Using connection pooler');
            console.log('   If pooler is having issues, try direct connection:');
            console.log('   Replace "pooler.supabase.com" with "db.supabase.co"');
            console.log('   And change port from 5432 to 5432 (or use 6543 for pooler)');
        }
    } else {
        console.log('   ⚠️  Could not parse DATABASE_URL format');
    }
    
    console.log('\n🔌 Testing connection...\n');
    
    const prisma = new PrismaClient();
    
    try {
        // Try to connect
        await prisma.$connect();
        console.log('✅ Prisma client connected successfully');
        
        // Try a simple query
        const result = await prisma.$queryRaw`SELECT 1 as test`;
        console.log('✅ Query executed successfully');
        
        // Try to count accounts
        const accountCount = await prisma.account.count();
        console.log(`✅ Found ${accountCount} account(s)`);
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('❌ Connection failed!\n');
        console.error('Error:', errorMessage);
        
        if (errorMessage.includes("Can't reach database server")) {
            console.error('\n💡 Troubleshooting steps:');
            console.error('   1. Check Supabase dashboard - is project really active?');
            console.error('   2. Try using direct connection URL (not pooler)');
            console.error('   3. Check if your IP is whitelisted in Supabase');
            console.error('   4. Try restarting your dev server');
            console.error('   5. Check network/firewall settings');
            console.error('\n   Direct connection format:');
            console.error('   postgresql://postgres.[ref]:[password]@aws-1-eu-central-2.db.supabase.co:5432/postgres');
        }
    } finally {
        await prisma.$disconnect();
    }
}

testDirectConnection();

