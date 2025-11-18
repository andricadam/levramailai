import { Account } from "@/lib/acount";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { syncEmailsToDatabase } from "@/lib/sync-to-db";

export const POST = async (req: NextRequest) => {
    const { accountId, userId } = await req.json();
    if (!accountId || !userId) {
        return NextResponse.json({ error: 'Missing accountId or userId' }, { status: 400 });
    }

    const dbAccount = await db.account.findUnique({
        where: {
            id: accountId,
            userId
        }
    })
    if (!dbAccount) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    const account = new Account(dbAccount.accessToken);
    const response = await account.performInitialSync();
    if (!response) {
        return NextResponse.json({ error: 'Failed to perform initial sync' }, { status: 500 });
    }
    const { emails, deltaToken } = response

    // Log initial sync completion with email count (like in tutorial)
    console.log(`initial sync completed, we have synced ${emails.length} emails`);

    // Sync emails to database (this will log "upserting email X" for each email)
    await syncEmailsToDatabase(emails, accountId);

    // Log the delta token after sync completes (like in the tutorial)
    console.log('sync completed', deltaToken);

    // TODO: Add nextDeltaToken field to Account model in schema
    // await db.account.update({
    //     where: {
    //         id: accountId,
    //     },
    //     data: {
    //         nextDeltaToken: deltaToken
    //     }
    // })

    console.log('Initial sync triggered', { success: true });
    return NextResponse.json({ success: true }, { status: 200 });
}