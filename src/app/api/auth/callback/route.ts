import { auth, currentUser } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForAccessToken, getAccountDetails } from '@/lib/aurinko'
import { db } from '@/server/db'

export async function GET(req: NextRequest) {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized'}, { status: 401 })

    const params = req.nextUrl.searchParams
    const status = params.get('status')
    if (status !== 'success') return NextResponse.json({ message: 'Failed to link account'}, { status: 400 })

    // get the code to exchange for the access token
    const code = params.get('code')
    if (!code) return NextResponse.json({ error: 'No code provided'}, { status: 400 })
    
    let token
    try {
        token = await exchangeCodeForAccessToken(code)
    } catch (error) {
        console.error('Error in exchangeCodeForAccessToken:', error)
        return NextResponse.json({ 
            error: error instanceof Error ? error.message : 'Failed to exchange code for access token'
        }, { status: 400 })
    }

    const accountDetails = await getAccountDetails(token.accessToken)

    // Ensure the User exists before creating the Account
    const user = await currentUser()
    if (!user) {
        return NextResponse.json({ error: 'User not found'}, { status: 401 })
    }

    // Get user email - try primary email first, then first email
    const primaryEmail = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress
        || user.emailAddresses[0]?.emailAddress

    if (!primaryEmail) {
        return NextResponse.json({ error: 'User email not found'}, { status: 400 })
    }

    // Upsert user to ensure it exists
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

    // Now create/update the account
    await db.account.upsert({
        where: {
            id: token.accountId.toString()
        },
        update: {
            accessToken: token.accessToken,
        },
        create: {
            id: token.accountId.toString(),
            userId,
            emailAddress: accountDetails.email,
            name: accountDetails.name,
            accessToken: token.accessToken,
        }
    })

    return NextResponse.redirect(new URL('/mail', req.url))
}

