# Fix Database Connection Issue

## Problem
Can't reach database server at `aws-1-eu-central-2.pooler.supabase.com:5432`

## Solutions to Try

### Option 1: Use Direct Connection (Recommended)
The pooler might be having issues. Try using the direct connection URL:

1. Go to your Supabase Dashboard
2. Go to Settings → Database
3. Find "Connection string" section
4. Select "URI" format (not "Connection pooling")
5. Copy the connection string
6. Update your `.env` file with this URL

The direct connection should look like:
```
DATABASE_URL="postgresql://postgres.trnchwsufckmuyuhcxxz:[PASSWORD]@aws-1-eu-central-2.db.supabase.co:5432/postgres?sslmode=require"
```

Note: Replace `pooler.supabase.com` with `db.supabase.co`

### Option 2: Use Pooler Port 6543
If you want to keep using the pooler, try port 6543 instead of 5432:

```
DATABASE_URL="postgresql://postgres.trnchwsufckmuyuhcxxz:[PASSWORD]@aws-1-eu-central-2.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true"
```

### Option 3: Check Supabase Project Status
1. Go to https://supabase.com/dashboard
2. Check if your project shows any warnings or errors
3. Check the "Database" section for connection issues
4. Try restarting/resuming the project if needed

### Option 4: Restart Dev Server
Sometimes the Prisma client gets stuck:
1. Stop your dev server (Ctrl+C)
2. Restart: `npm run dev`
3. This reinitializes the Prisma client

### Option 5: Check Network/Firewall
- Make sure your IP isn't blocked
- Check if you're behind a VPN that might block connections
- Try from a different network

## After Changing DATABASE_URL
1. Restart your dev server
2. Run: `npx tsx src/test-db-connection.ts` to test
3. Refresh your browser

