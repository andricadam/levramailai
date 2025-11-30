# Scripts

## create-calendar-connection.ts

Creates missing Calendar `AppConnection` entries for users who connected their email accounts before the auto-creation feature was implemented. Supports both Google and Microsoft accounts.

### Usage

1. **Find your User ID:**
   ```sql
   SELECT id, "emailAddress" FROM "User";
   ```
   Or check your Clerk dashboard.

2. **Run the script:**
   ```bash
   # Create calendar connections for all accounts (Google and Microsoft)
   npx tsx src/scripts/create-calendar-connection.ts <your-user-id>
   
   # Create only for Google accounts
   npx tsx src/scripts/create-calendar-connection.ts <your-user-id> google
   
   # Create only for Microsoft accounts
   npx tsx src/scripts/create-calendar-connection.ts <your-user-id> microsoft
   ```

### What it does

- Finds your email accounts in the database (Google and/or Microsoft)
- Checks if calendar connections already exist for each account
- Creates new `AppConnection` entries with type `google_calendar` or `microsoft_calendar` if missing
- Links them to the respective email accounts
- Triggers initial calendar syncs
- Enables the connections so they appear in the calendar view

### Examples

```bash
# Create calendar connections for all accounts
npx tsx src/scripts/create-calendar-connection.ts user_2abc123def456

# Create only Google Calendar connection
npx tsx src/scripts/create-calendar-connection.ts user_2abc123def456 google

# Create only Microsoft Calendar connection
npx tsx src/scripts/create-calendar-connection.ts user_2abc123def456 microsoft
```

### Output

The script will:
- ✅ Show all accounts found
- ✅ Process each account (Google/Microsoft)
- ✅ Create calendar connections for each
- ✅ Trigger syncs (may take a moment)
- ✅ Confirm completion

After running, refresh your calendar view in the app - it should now show calendar events for the selected account!
