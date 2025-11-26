import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { initializeUIKnowledge, initializeUIKnowledgeForAccount } from '@/lib/init-ui-knowledge'
import { db } from '@/server/db'

export async function POST(req: Request) {
  const { userId } = await auth()
  
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const accountId = body.accountId

    if (accountId) {
      // Initialize for specific account
      await initializeUIKnowledgeForAccount(accountId)
      return NextResponse.json({ 
        success: true, 
        message: `UI knowledge initialized for account ${accountId}` 
      })
    } else {
      // Initialize for all accounts
      await initializeUIKnowledge()
      return NextResponse.json({ 
        success: true, 
        message: 'UI knowledge initialized for all accounts' 
      })
    }
  } catch (error) {
    console.error('Failed to initialize UI knowledge:', error)
    return NextResponse.json({ 
      error: 'Failed to initialize UI knowledge',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

