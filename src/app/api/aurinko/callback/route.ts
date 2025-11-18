import { getAccountDetails, exchangeCodeForAccessToken } from "@/lib/aurinko";
import { db } from "@/server/db";
import { auth } from "@clerk/nextjs/server";
import { type NextRequest, NextResponse } from "next/server";
import { Account } from "@/lib/acount";

export const GET = async (req: NextRequest) => {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const params = req.nextUrl.searchParams
    const status = params.get('status');
    if (status !== 'success') return NextResponse.json({ error: "Account connection failed" }, { status: 400 });

    const code = params.get('code');
    const token = await exchangeCodeForAccessToken(code as string)
    if (!token) return NextResponse.json({ error: "Failed to fetch token" }, { status: 400 });
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
            
            // TODO: Add nextDeltaToken field to Account model in schema
            // await db.account.update({
            //     where: { id: token.accountId.toString() },
            //     data: { nextDeltaToken: deltaToken }
            // })
            
            // TODO: Implement syncEmailsToDatabase function
            // await syncEmailsToDatabase(emails);
            
            console.log('Initial sync triggered', { success: true });
        }
    } catch (error) {
        console.error('Error during initial sync:', error);
    }

    return NextResponse.redirect(new URL('/mail', req.url))
}