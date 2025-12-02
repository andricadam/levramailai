# Database Pooler Guide for Prisma

## Quick Answer: Use **Session Pooler** for Prisma

For Prisma with Next.js, **Session pooler** is recommended because Prisma uses prepared statements, which Transaction Pooler doesn't support.

## How to Get the Correct Connection String

1. Go to Supabase Dashboard → Your Project → Settings → Database
2. Click on **"Connection string"** section
3. Select **"Connection pooling"** tab
4. Set **"Method"** to **"Transaction pooler"** (not Session pooler)
5. Copy the connection string
6. It should use port **6543** (not 5432)

## Connection String Format

**Session Pooler (Recommended for Prisma):**
```
postgresql://postgres.trnchwsufckmuyuhcxxz:[PASSWORD]@aws-1-eu-central-2.pooler.supabase.com:5432/postgres?sslmode=require&pgbouncer=true
```

**Transaction Pooler (Only if you disable prepared statements):**
```
postgresql://postgres.trnchwsufckmuyuhcxxz:[PASSWORD]@aws-1-eu-central-2.pooler.supabase.com:6543/postgres?sslmode=require&prepared_statements=false
```

**Note:** Session Pooler uses port 5432, Transaction Pooler uses port 6543.

**Direct Connection (Alternative):**
```
postgresql://postgres.trnchwsufckmuyuhcxxz:[PASSWORD]@aws-1-eu-central-2.db.supabase.co:5432/postgres?sslmode=require
```

## Differences

| Feature | Session Pooler | Transaction Pooler | Direct Connection |
|---------|----------------|-------------------|-------------------|
| **Port** | 5432 | 6543 | 5432 |
| **Best For** | Prisma (uses prepared statements) | Raw SQL, simple queries | Development |
| **Prepared Statements** | ✅ Supported | ❌ Not supported | ✅ Supported |
| **Efficiency** | High | Very High | Low (no pooling) |
| **Serverless** | ⚠️ Limited | ✅ Yes | ❌ No |
| **Prisma Recommended** | ✅ Yes | ❌ No (unless disabled) | ✅ Yes |

## Why Session Pooler for Prisma?

- Prisma uses prepared statements for performance
- Transaction Pooler doesn't support prepared statements
- Session Pooler maintains session state (needed for prepared statements)
- Better compatibility with Prisma's query engine
- Avoids "prepared statement does not exist" errors

## After Updating

1. Update `.env` file with the new `DATABASE_URL`
2. Restart your dev server: `npm run dev`
3. Test connection: `npx tsx src/test-db-connection-v2.ts`

