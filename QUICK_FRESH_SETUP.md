# Quick Fresh Setup (Skip Slow db push)

Since you're doing a fresh setup and deleted everything, you have two options:

## Option 1: Let Prisma Create Tables Automatically (Recommended)

**Don't run `db push` manually!** Just:

1. **Start your dev server:**
   ```bash
   npm run dev
   ```

2. **Go to `/mail` and click "Add account"**

3. **Prisma will create tables automatically** when you first try to save data

This is actually faster because:
- Tables are created on-demand
- No need to wait for full schema sync
- Your app will work immediately

## Option 2: Use Direct Connection for db push (Faster)

If you really want to run `db push`:

1. **Temporarily switch to direct connection** in `.env`:
   ```
   DATABASE_URL="postgresql://postgres.trnchwsufckmuyuhcxxz:[PASSWORD]@aws-1-eu-central-2.db.supabase.co:5432/postgres?sslmode=require"
   ```

2. **Run db push:**
   ```bash
   npx prisma db push
   ```
   (This will be faster - 10-20 seconds instead of 30-60)

3. **Switch back to pooler** in `.env`:
   ```
   DATABASE_URL="postgresql://postgres.trnchwsufckmuyuhcxxz:[PASSWORD]@aws-1-eu-central-2.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true"
   ```

4. **Restart dev server**

## Why db push is Slow

- **Remote database** (Supabase) = network latency
- **Transaction pooler** = extra connection overhead  
- **Many tables** (User, Account, Thread, Email, EmailAddress, EmailAttachment) = lots of CREATE statements
- **Many indexes** (6+ indexes) = additional time
- **Database might be paused** = 30-60 second wake-up time

## Recommendation

**Just start your app!** Prisma will create tables when needed. This is the fastest way for a fresh setup.

