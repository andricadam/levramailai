import { auth } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
    const { userId } = await auth()
    console.log('userId is', userId)
    return NextResponse.json({ message: 'Hello World'})
}

