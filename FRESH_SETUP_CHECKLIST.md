# Fresh Database Setup Checklist

## ✅ Pre-Flight Checks

### 1. Database Connection String
Your `.env` file should have:
```
DATABASE_URL="postgresql://postgres.trnchwsufckmuyuhcxxz:[PASSWORD]@aws-1-eu-central-2.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true"
```

**Verify:**
- ✅ Uses Transaction Pooler (port `6543`)
- ✅ Has `&pgbouncer=true` (disables prepared statements)
- ✅ Has `?sslmode=require` (secure connection)
- ✅ Password is correct

### 2. Database Migrations
Run to ensure schema is up to date:
```bash
npx prisma db push
```

Or if you prefer migrations:
```bash
npx prisma migrate deploy
```

### 3. Prisma Client Generation
Make sure Prisma client is generated:
```bash
npx prisma generate
```

### 4. Environment Variables
Check your `.env` file has:
- ✅ `DATABASE_URL` - Database connection string
- ✅ `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk public key
- ✅ `CLERK_SECRET_KEY` - Clerk secret key
- ✅ `AURINKO_CLIENT_ID` - Aurinko client ID
- ✅ `AURINKO_CLIENT_SECRET` - Aurinko client secret
- ✅ `WEBHOOK_SECRET` - Clerk webhook secret (optional for account creation)

### 5. Aurinko Callback URL
Make sure your Aurinko dashboard has this callback URL:
```
http://localhost:3000/api/aurinko/callback
```
(Or your production URL if deployed)

## 🚀 Ready to Connect Account

Once all checks pass:

1. **Start your dev server:**
   ```bash
   npm run dev
   ```

2. **Go to `/mail` in your browser**

3. **Click "Add account" button**

4. **Sign in with Google via Aurinko**

5. **Account will be created automatically** and initial sync will start

## 🔍 Verify Database After Connection

Check that account was created:
```bash
npx tsx src/check-accounts.ts
```

## 📋 Database Schema Summary

Your database should have these tables:
- ✅ `User` - Clerk user data
- ✅ `Account` - Email accounts (Gmail, etc.)
- ✅ `Thread` - Email threads
- ✅ `Email` - Individual emails
- ✅ `EmailAddress` - Email addresses
- ✅ `EmailAttachment` - Email attachments

All relationships and indexes are configured correctly in `prisma/schema.prisma`.

