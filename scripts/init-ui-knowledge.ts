/**
 * Script to initialize UI knowledge for existing accounts
 * Run with: npx tsx scripts/init-ui-knowledge.ts
 */

import 'dotenv/config'
import { initializeUIKnowledge } from '../src/lib/init-ui-knowledge'

async function main() {
  console.log('Starting UI knowledge initialization for all existing accounts...')
  
  try {
    await initializeUIKnowledge()
    console.log('✅ UI knowledge initialization completed successfully!')
    process.exit(0)
  } catch (error) {
    console.error('❌ Failed to initialize UI knowledge:', error)
    process.exit(1)
  }
}

main()

