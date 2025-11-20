import { getAccountDetails, exchangeCodeForAccessToken } from "@/lib/aurinko";
import { db } from "@/server/db";
import { auth, currentUser } from "@clerk/nextjs/server";
import { type NextRequest, NextResponse } from "next/server";
import { Account } from "@/lib/acount";
import { syncEmailsToDatabase } from "@/lib/sync-emails";

export const GET = async (req: NextRequest) => {
    try {
        const { userId } = await auth()
        if (!userId) {
            return NextResponse.redirect(new URL('/sign-in?redirect_url=/mail', req.url))
        }

        const params = req.nextUrl.searchParams
        const status = params.get('status');
        
        // Handle error status from Aurinko
        if (status === 'error') {
            const error = params.get('error') || 'Unknown error'
            console.error('Aurinko auth error:', error)
            return NextResponse.redirect(new URL(`/mail?error=${encodeURIComponent(error)}`, req.url))
        }
        
        if (status !== 'success') {
            return NextResponse.redirect(new URL('/mail?error=Account connection failed', req.url))
        }

        const code = params.get('code');
        if (!code) {
            return NextResponse.redirect(new URL('/mail?error=No authorization code provided', req.url))
        }

        let token;
        try {
            token = await exchangeCodeForAccessToken(code)
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to exchange code for access token'
            console.error('Token exchange error:', errorMessage)
            
            // Check if it's an expired code error
            if (errorMessage.includes('code.expired')) {
                return NextResponse.redirect(new URL('/mail?error=Authorization code expired. Please try adding the account again.', req.url))
            }
            
            return NextResponse.redirect(new URL(`/mail?error=${encodeURIComponent(errorMessage)}`, req.url))
        }
        
        if (!token) {
            return NextResponse.redirect(new URL('/mail?error=Failed to fetch token', req.url))
        }

        // Get account details
        let accountDetails;
        try {
            accountDetails = await getAccountDetails(token.accessToken)
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to fetch account details'
            console.error('Account details error:', errorMessage)
            return NextResponse.redirect(new URL(`/mail?error=${encodeURIComponent(errorMessage)}`, req.url))
        }

        // Ensure the User exists before creating the Account
        let user;
        try {
            user = await currentUser()
            if (!user) {
                return NextResponse.redirect(new URL('/mail?error=User not found in Clerk', req.url))
            }

            // Get user email - try primary email first, then first email
            const primaryEmail = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress
                || user.emailAddresses[0]?.emailAddress

            if (!primaryEmail) {
                return NextResponse.redirect(new URL('/mail?error=User email not found', req.url))
            }

            // Upsert user to ensure it exists in the database
            await db.user.upsert({
                where: { id: userId },
                update: {
                    emailAddress: primaryEmail,
                    firstName: user.firstName || '',
                    lastName: user.lastName || '',
                    imageUrl: user.imageUrl || null,
                },
                create: {
                    id: userId,
                    emailAddress: primaryEmail,
                    firstName: user.firstName || '',
                    lastName: user.lastName || '',
                    imageUrl: user.imageUrl || null,
                },
            })
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to ensure user exists'
            console.error('User upsert error:', errorMessage)
            console.error('Full error:', error)
            return NextResponse.redirect(new URL(`/mail?error=${encodeURIComponent(errorMessage)}`, req.url))
        }

        // Save account to database (now that user exists)
        try {
            await db.account.upsert({
                where: { id: token.accountId.toString() },
                create: {
                    id: token.accountId.toString(),
                    userId,
                    accessToken: token.accessToken,
                    emailAddress: accountDetails.email,
                    name: accountDetails.name
                },
                update: {
                    accessToken: token.accessToken,
                }
            })
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to save account to database'
            console.error('Database error:', errorMessage)
            console.error('Full error:', error)
            return NextResponse.redirect(new URL(`/mail?error=${encodeURIComponent(errorMessage)}`, req.url))
        }
        
        // Trigger initial sync - run it directly so we can see logs in development
        console.log('Starting initial sync...');
        try {
            const account = new Account(token.accessToken);
            const response = await account.performInitialSync();
            if (!response) {
                console.error('Failed to perform initial sync');
            } else {
                const { emails, deltaToken } = response;
                
                // Log emails like in the tutorial
                console.log(emails);
                
                // Save the delta token to the database for future incremental syncs
                try {
                    await db.account.update({
                        where: { id: token.accountId.toString() },
                        data: { nextDeltaToken: deltaToken }
                    })
                } catch (error) {
                    console.error('Error saving delta token:', error);
                    // Don't fail the whole flow if delta token save fails
                }
                
                // Sync emails to database (creates threads, emails, email addresses, attachments)
                try {
                    await syncEmailsToDatabase(token.accountId.toString(), emails);
                    console.log('Emails synced to database successfully');
                } catch (error) {
                    console.error('Error syncing emails to database:', error);
                    // Don't fail the whole flow if sync fails - account is already saved
                }
                
                console.log('Initial sync triggered', { success: true });
            }
        } catch (error) {
            console.error('Error during initial sync:', error);
            // Don't fail the whole flow if sync fails - account is already saved
        }

        return NextResponse.redirect(new URL('/mail', req.url))
    } catch (error) {
        // Catch any unexpected errors
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
        console.error('Unexpected error in callback:', errorMessage)
        console.error('Full error:', error)
        return NextResponse.redirect(new URL(`/mail?error=${encodeURIComponent(errorMessage)}`, req.url))
    }
}