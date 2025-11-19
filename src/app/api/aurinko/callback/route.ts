import { getAccountDetails, exchangeCodeForAccessToken } from "@/lib/aurinko";
import { db } from "@/server/db";
import { auth } from "@clerk/nextjs/server";
import { type NextRequest, NextResponse } from "next/server";
import { Account } from "@/lib/acount";

export const GET = async (req: NextRequest) => {
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
    const accountDetails = await getAccountDetails(token.accessToken)
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
            await db.account.update({
                where: { id: token.accountId.toString() },
                data: { nextDeltaToken: deltaToken }
            })
            
            // TODO: Implement syncEmailsToDatabase function
            // await syncEmailsToDatabase(emails);
            
            console.log('Initial sync triggered', { success: true });
        }
    } catch (error) {
        console.error('Error during initial sync:', error);
    }

    return NextResponse.redirect(new URL('/mail', req.url))
}