# Aurinko Callback URL Configuration

## Current Error
You're getting: `{"code":"returnurl.invalid","message":"returnurl.invalid: returnUrl doesn't match the configured urls for the app."}`

## Quick Fix: Use Environment Variable (Recommended)

The easiest way to fix this is to set an explicit base URL in your `.env` file:

```bash
AURINKO_RETURN_URL_BASE=http://localhost:3000
```

This ensures the returnUrl is always `http://localhost:3000/api/aurinko/callback` regardless of how the request headers are set.

## How to Fix (Manual Configuration)

### Step 1: Check Your Terminal/Console
When you click "Add account", check your terminal where `npm run dev` is running. You should see output like:

```
============================================================
🔴 AURINKO CALLBACK URL CONFIGURATION REQUIRED
============================================================
⚠️  You MUST add this EXACT URL to your Aurinko app settings:

   http://localhost:3000/api/aurinko/callback
```

**Note:** If you see a different URL in the terminal, that's the one you need to add to Aurinko. The URL is constructed from your request headers, or you can set `AURINKO_RETURN_URL_BASE` in your `.env` file to use a fixed URL.

### Step 2: Add URL to Aurinko Dashboard

1. **Go to Aurinko Developer Dashboard:**
   - Visit: https://developer.aurinko.io/
   - Or your Aurinko dashboard URL

2. **Find Your App:**
   - Look for your app with Client ID starting with: `4fec5f5764ecb9069544cc813d126c70`

3. **Navigate to OAuth Settings:**
   - Look for sections like:
     - "OAuth Settings"
     - "Callback URLs"
     - "Redirect URLs"
     - "Return URLs"
     - "Allowed URLs"

4. **Add the Callback URL:**
   - Copy the EXACT URL from your terminal output
   - For local development, it should be: `http://localhost:3000/api/aurinko/callback`
   - Paste it into the callback/redirect URL field
   - **Important:** Make sure there's NO trailing slash

5. **Save Settings:**
   - Click Save/Update
   - Wait a few seconds for changes to propagate

### Step 3: Common Issues

- **Trailing Slash:** Make sure the URL doesn't end with `/`
  - ✅ Correct: `http://localhost:3000/api/aurinko/callback`
  - ❌ Wrong: `http://localhost:3000/api/aurinko/callback/`

- **Protocol Mismatch:** Make sure you're using `http://` for localhost
  - ✅ Correct: `http://localhost:3000/api/aurinko/callback`
  - ❌ Wrong: `https://localhost:3000/api/aurinko/callback`

- **Port Number:** Make sure the port matches (usually 3000 for Next.js)
  - If you're running on a different port, use that port number

- **Path Must Match Exactly:**
  - ✅ Correct: `/api/aurinko/callback`
  - ❌ Wrong: `/api/auth/callback` or `/callback`

### Step 4: For Production

When deploying to production, you'll also need to add your production URL:
- Example: `https://yourdomain.com/api/aurinko/callback`

## Still Having Issues?

1. **Double-check the terminal output** - The exact URL is logged there
2. **Verify in Aurinko dashboard** - Make sure the URL is saved correctly
3. **Try clearing browser cache** - Sometimes cached redirects cause issues
4. **Wait a few minutes** - Changes in Aurinko can take a moment to propagate

