# Fix Database Authentication Error

## Current Issue
"Authentication failed" - The connection works but credentials are invalid.

## Your Current URL Format
```
postgresql://postgres.trnchwsufckmuyuhcxxz:***@aws-1-eu-central-2.pooler.supabase.com:5432/postgres
```

**Problem:** Missing query parameters and possibly wrong format for pooler.

## Solution: Get Correct Connection String from Supabase

### Step 1: Get Pooler Connection String (Recommended)
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to **Settings** → **Database**
4. Scroll to **Connection string** section
5. Select **"Connection pooling"** tab
6. Select **"Session mode"** (not Transaction mode)
7. Copy the **URI** connection string
8. It should look like:
   ```
   postgresql://postgres.trnchwsufckmuyuhcxxz:[PASSWORD]@aws-1-eu-central-2.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true
   ```
   **Note:** Port should be **6543** (not 5432) for pooler!

### Step 2: Or Use Direct Connection
1. In the same **Connection string** section
2. Select **"URI"** tab (not Connection pooling)
3. Copy the connection string
4. It should look like:
   ```
   postgresql://postgres.trnchwsufckmuyuhcxxz:[PASSWORD]@aws-1-eu-central-2.db.supabase.co:5432/postgres?sslmode=require
   ```
   **Note:** Uses `db.supabase.co` (not pooler)

### Step 3: Update .env File
1. Open your `.env` file
2. Replace the `DATABASE_URL` with the connection string from Supabase
3. Make sure the password is correct (it's shown in Supabase dashboard)

### Step 4: Test
```bash
npx tsx src/test-db-connection-v2.ts
```

## Common Issues

### Issue 1: Wrong Port for Pooler
- Pooler should use port **6543** (not 5432)
- Direct connection uses port **5432**

### Issue 2: Missing Query Parameters
- Pooler needs: `?sslmode=require&pgbouncer=true`
- Direct needs: `?sslmode=require`

### Issue 3: Wrong Host
- Pooler: `pooler.supabase.com`
- Direct: `db.supabase.co`

## Quick Fix
The easiest solution is to copy the exact connection string from Supabase dashboard - it will have all the correct parameters!

