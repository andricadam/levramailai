import { getEmbeddings } from './embedding'
import { OpenAIApi, Configuration } from 'openai-edge'

const config = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
})

const openai = new OpenAIApi(config)

export type ProcessedFile = {
  text: string
  embeddings: number[]
  metadata: {
    fileName: string
    mimeType: string
    size: number
    pageCount?: number
  }
}

// File size limit: 10MB
export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB in bytes

export async function processFile(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<ProcessedFile> {
  // Validate file size
  if (fileBuffer.length > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds maximum limit of 10MB`)
  }

  let extractedText = ''

  // Extract text based on file type
  if (mimeType === 'application/pdf') {
    // Dynamic import for pdf-parse (it's a CommonJS module)
    const pdfParse = (await import('pdf-parse')).default
    const pdfData = await pdfParse(fileBuffer)
    extractedText = pdfData.text
  } 
  else if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword'
  ) {
    // Dynamic import for mammoth
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer: fileBuffer })
    extractedText = result.value
  }
  else if (mimeType.startsWith('text/')) {
    extractedText = fileBuffer.toString('utf-8')
  }
  else if (mimeType.startsWith('image/')) {
    // Use OpenAI Vision API for OCR
    extractedText = await extractTextFromImageWithOpenAI(fileBuffer, mimeType)
  }
  else {
    throw new Error(`Unsupported file type: ${mimeType}`)
  }

  if (!extractedText || extractedText.trim().length === 0) {
    throw new Error('No text could be extracted from the file')
  }

  // Generate embeddings
  const embeddings = await getEmbeddings(extractedText)

  return {
    text: extractedText,
    embeddings,
    metadata: {
      fileName,
      mimeType,
      size: fileBuffer.length,
    }
  }
}

/**
 * Extract text from images using OpenAI Vision API
 */
async function extractTextFromImageWithOpenAI(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  try {
    // Validate image size (OpenAI has limits)
    const MAX_IMAGE_SIZE = 20 * 1024 * 1024 // 20MB for OpenAI
    if (buffer.length > MAX_IMAGE_SIZE) {
      throw new Error('Image size exceeds maximum limit of 20MB for OCR processing')
    }

    // Convert buffer to base64
    const base64Image = buffer.toString('base64')
    
    // Call OpenAI Vision API
    const response = await openai.createChatCompletion({
      model: 'gpt-4o', // Using gpt-4o which supports vision
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract all text from this image. Return only the extracted text, no explanations or formatting. If there is no text, return "No text found in image".'
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 1000, // Adjust based on expected text length
    })

    const result = await response.json()
    
    if (!response.ok || result.error) {
      throw new Error(result.error?.message || 'Failed to extract text from image')
    }

    const extractedText = result.choices?.[0]?.message?.content || ''
    
    if (!extractedText || extractedText.toLowerCase().includes('no text found')) {
      throw new Error('No text found in image')
    }

    return extractedText.trim()
  } catch (error) {
    console.error('OpenAI Vision API error:', error)
    throw new Error(`Failed to extract text from image: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

