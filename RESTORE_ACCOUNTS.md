# How to Restore Account Switcher

## What Happened?

When you deleted accounts from the database, you likely ended up with **0 accounts**. The account switcher only appears when you have **at least 1 account**. With 0 accounts, the UI shows an "Add account" button instead.

## Quick Fix: Add Accounts Back

### Step 1: Add Your First Account
1. Go to `/mail` in your application
2. You should see an **"Add account"** button (this appears when you have 0 accounts)
3. Click it to start the OAuth flow
4. Sign in with a Google account via Aurinko
5. After redirect, the **account switcher will automatically appear** ✅

### Step 2: Add Your Second Account
1. Click on the **account switcher dropdown** (now visible)
2. Scroll to the bottom of the dropdown
3. Click **"Add account"** at the bottom
4. Sign in with another Google account
5. You now have 2 accounts and can switch between them! ✅

## Why This Happened

The `AccountSwitcher` component has this logic:
- **0 accounts** → Shows "Add account" button
- **1+ accounts** → Shows account switcher dropdown

This is by design - the switcher only makes sense when you have accounts to switch between.

## Troubleshooting

If the switcher doesn't appear after adding an account:
1. Check the browser console for errors
2. Verify the account was saved to the database (check your terminal logs)
3. Refresh the page
4. Check that you're signed in with Clerk

## Next Steps

Once you have 2 accounts:
- The switcher will be visible in the sidebar
- You can switch between accounts using the dropdown
- Each account maintains its own emails and `nextDeltaToken`
- You can continue with the tutorial step that requires `nextDeltaToken`

