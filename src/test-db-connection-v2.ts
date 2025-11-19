import { PrismaClient } from "../generated/prisma";

// Test different connection string formats
async function testConnection() {
    console.log('🔍 Testing database connection with diagnostics...\n');
    
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.error('❌ DATABASE_URL is not set');
        return;
    }
    
    console.log('📋 Current DATABASE_URL format:');
    console.log(`   ${dbUrl.replace(/:[^:@]+@/, ':***@')}\n`);
    
    // Check URL components
    try {
        const url = new URL(dbUrl.replace('postgresql://', 'http://'));
        console.log('URL Components:');
        console.log(`   Host: ${url.hostname}`);
        console.log(`   Port: ${url.port || 'default'}`);
        console.log(`   Path: ${url.pathname}`);
        console.log(`   Query: ${url.search || 'none'}`);
    } catch (e) {
        console.log('   Could not parse URL');
    }
    
    console.log('\n🔌 Testing Prisma connection...\n');
    
    const prisma = new PrismaClient({
        log: ['error', 'warn'],
    });
    
    try {
        // Try to connect
        console.log('1. Attempting to connect...');
        await prisma.$connect();
        console.log('   ✅ Connected!');
        
        // Try a simple query
        console.log('2. Testing query...');
        const result = await prisma.$queryRaw`SELECT 1 as test`;
        console.log('   ✅ Query successful:', result);
        
        // Try to count accounts
        console.log('3. Counting accounts...');
        const accountCount = await prisma.account.count();
        console.log(`   ✅ Found ${accountCount} account(s)`);
        
        if (accountCount > 0) {
            const accounts = await prisma.account.findMany({
                select: {
                    id: true,
                    emailAddress: true,
                    userId: true,
                },
                take: 5
            });
            console.log('\n📧 Accounts:');
            accounts.forEach(acc => {
                console.log(`   - ${acc.emailAddress} (ID: ${acc.id})`);
            });
        }
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('\n❌ Connection failed!\n');
        console.error('Error:', errorMessage);
        
        if (errorMessage.includes("unexpected message from server")) {
            console.error('\n💡 This error usually means:');
            console.error('   1. Connection string format issue');
            console.error('   2. SSL/TLS configuration problem');
            console.error('   3. Protocol mismatch (pooler vs direct)');
            console.error('\n🔧 Try these fixes:');
            console.error('\n   Option A: Use direct connection (not pooler)');
            console.error('   - Go to Supabase Dashboard → Settings → Database');
            console.error('   - Copy "Connection string" → "URI" (not pooling)');
            console.error('   - Should use: db.supabase.co (not pooler.supabase.com)');
            console.error('\n   Option B: Fix pooler connection');
            console.error('   - Use port 6543 instead of 5432');
            console.error('   - Add: ?pgbouncer=true&sslmode=require');
            console.error('\n   Option C: Check SSL mode');
            console.error('   - Make sure ?sslmode=require is in the URL');
            console.error('   - Or try: ?sslmode=prefer');
        }
    } finally {
        await prisma.$disconnect();
    }
}

testConnection();

