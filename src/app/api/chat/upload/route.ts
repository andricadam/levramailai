import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/server/db'
import { processFile, MAX_FILE_SIZE } from '@/lib/file-processor'
import { OramaClient } from '@/lib/orama'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File
    const accountId = formData.get('accountId') as string
    const addToKnowledgeBase = formData.get('addToKnowledgeBase') === 'true'

    if (!file || !accountId) {
      return NextResponse.json(
        { error: 'File and accountId are required' },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds maximum limit of 10MB` },
        { status: 400 }
      )
    }

    // Verify account
    const account = await db.account.findFirst({
      where: { id: accountId, userId }
    })

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Process file (extract text, generate embeddings)
    const processed = await processFile(buffer, file.name, file.type)

    // Store file only if added to knowledge base
    let fileUrl: string | null = null
    
    if (addToKnowledgeBase) {
      // Store permanently
      const uploadsDir = join(process.cwd(), 'uploads', userId)
      await mkdir(uploadsDir, { recursive: true })
      fileUrl = join(uploadsDir, `${Date.now()}-${file.name}`)
      await writeFile(fileUrl, buffer)
    }

    // Save to database
    const attachment = await db.chatAttachment.create({
      data: {
        userId,
        accountId,
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
        fileUrl,
        extractedText: processed.text,
        inKnowledgeBase: addToKnowledgeBase,
        processedAt: new Date(),
      }
    })

    // Index in Orama if added to knowledge base
    if (addToKnowledgeBase) {
      const orama = new OramaClient(accountId)
      await orama.initialize()
      
      await orama.insert({
        subject: file.name,
        body: processed.text,
        rowBody: processed.text,
        from: userId,
        to: [],
        sentAt: new Date().toISOString(),
        threadId: attachment.id,
        source: 'file',
        sourceId: attachment.id,
        fileName: file.name,
        embeddings: processed.embeddings
      } as any) // Type assertion needed due to schema evolution

      await db.chatAttachment.update({
        where: { id: attachment.id },
        data: { indexedAt: new Date() }
      })
    }

    return NextResponse.json({
      id: attachment.id,
      fileName: file.name,
      size: file.size,
      mimeType: file.type,
      inKnowledgeBase: addToKnowledgeBase,
    })
  } catch (error) {
    console.error('File upload error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to process file'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

