# Fix: "prepared statement does not exist" Error

## The Problem

You're seeing this error:
```
prepared statement "s2" does not exist
```

This happens because:
- **Prisma uses prepared statements** for better performance
- **Transaction Pooler doesn't support prepared statements** (it pools at transaction level, not session level)
- When Prisma tries to reuse a prepared statement, it fails

## Solution 1: Switch to Session Pooler (Recommended)

**Best for Prisma** - Session Pooler supports prepared statements.

1. Go to Supabase Dashboard → Settings → Database → Connection string
2. Select **"Connection pooling"** tab
3. Change **"Method"** from **"Transaction pooler"** to **"Session pooler"**
4. Copy the connection string
5. Update your `.env` file

**Connection string format:**
```
postgresql://postgres.trnchwsufckmuyuhcxxz:[PASSWORD]@aws-1-eu-central-2.pooler.supabase.com:5432/postgres?sslmode=require&pgbouncer=true
```

**Note:** Port changes from `6543` to `5432`

## Solution 2: Disable Prepared Statements for Transaction Pooler (Your Current Setup)

Since Transaction Pooler works for you but gives prepared statement errors, add `&pgbouncer=true` to disable prepared statements:

**Your current connection string (working but has errors):**
```
postgresql://postgres.trnchwsufckmuyuhcxxz:[PASSWORD]@aws-1-eu-central-2.pooler.supabase.com:6543/postgres?sslmode=require
```

**Fixed connection string (add pgbouncer=true):**
```
postgresql://postgres.trnchwsufckmuyuhcxxz:[PASSWORD]@aws-1-eu-central-2.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true
```

**Note:** The `pgbouncer=true` parameter tells Prisma to disable prepared statements, which fixes the error while keeping Transaction Pooler.

## Why This Happens

| Pooler Type | Prepared Statements | Best For |
|------------|-------------------|----------|
| **Session Pooler** | ✅ Supported | Prisma (recommended) |
| **Transaction Pooler** | ❌ Not supported | Raw SQL, simple queries |
| **Direct Connection** | ✅ Supported | Development |

## After Fixing

1. Update `.env` file with new connection string
2. Restart dev server: `npm run dev`
3. The error should be gone!

## Recommendation

**If Transaction Pooler works for you:** Add `&pgbouncer=true` to disable prepared statements and fix the error.

**If you want to use Session Pooler:** Make sure you're using the correct connection string format from Supabase dashboard.

