import axios from 'axios'

// Using Serper API (Google search results)
const SERPER_API_KEY = process.env.SERPER_API_KEY
const SERPER_API_URL = 'https://google.serper.dev/search'

export type WebSearchResult = {
  title: string
  url: string
  content: string
  position?: number
}

export type WebSearchResponse = {
  results: WebSearchResult[]
  query: string
}

/**
 * Search the web for current information using Serper API
 * Returns relevant search results for RAG context
 */
export async function searchWeb(
  query: string,
  maxResults: number = 5
): Promise<WebSearchResponse | null> {
  if (!SERPER_API_KEY) {
    console.warn('SERPER_API_KEY not set, web search disabled')
    return null
  }

  try {
    const response = await axios.post(
      SERPER_API_URL,
      {
        q: query,
        num: maxResults,
      },
      {
        timeout: 10000, // 10 second timeout
        headers: {
          'X-API-KEY': SERPER_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    )

    const data = response.data

    // Extract organic search results
    const organicResults = (data.organic || []).slice(0, maxResults)

    return {
      query,
      results: organicResults.map((result: any, index: number) => ({
        title: result.title || '',
        url: result.link || '',
        content: result.snippet || '',
        position: index + 1,
      })),
    }
  } catch (error) {
    console.error('Web search error:', error)
    if (axios.isAxiosError(error)) {
      console.error('Serper API error:', error.response?.status, error.response?.data)
    }
    return null
  }
}

/**
 * Format web search results for RAG context
 */
export function formatWebSearchResults(results: WebSearchResult[]): string {
  if (results.length === 0) return ''

  return results
    .map(
      (result) =>
        `Title: ${result.title}\nURL: ${result.url}\nContent: ${result.content}`
    )
    .join('\n\n---\n\n')
}

