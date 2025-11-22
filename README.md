# LevraMail AI

An intelligent email and calendar management application powered by AI, built with the T3 Stack. LevraMail AI helps you manage multiple email accounts, search through your emails intelligently, and get AI-powered answers about your inbox.

## Features

### Email Management
- **Multi-Account Support**: Connect and manage multiple email accounts through Aurinko integration
- **Email Threading**: View conversations as threaded discussions for better context
- **Organized Views**: Access your inbox, drafts, sent emails, and completed threads
- **Email Composition**: Rich text email editor with support for replies, reply-all, and forwarding
- **Search**: Full-text search across email subjects, bodies, and sender addresses
- **Account Switching**: Seamlessly switch between multiple connected email accounts

### Calendar Integration
- **Calendar View**: View and manage your calendar events
- **Synchronized**: Calendar data synced with your email accounts

### AI-Powered Features

#### Intelligent Email Assistant
The AI assistant uses advanced vector search and natural language processing to answer questions about your emails:

- **Context-Aware Responses**: The AI understands your email history and can answer questions based on your actual emails
- **Vector Search**: Uses OpenAI embeddings and Orama's hybrid search (semantic + keyword) to find relevant emails
- **Natural Language Queries**: Ask questions in plain English like:
  - "When is my next flight?"
  - "When is my next meeting?"
  - "What emails did I receive from [person] last week?"
  - "Summarize my unread emails"
- **Real-Time Streaming**: Get AI responses streamed in real-time for a smooth conversational experience

#### How It Works
1. **Email Indexing**: Your emails are automatically indexed with vector embeddings using OpenAI's `text-embedding-ada-002` model
2. **Hybrid Search**: When you ask a question, the system performs a hybrid search combining:
   - Semantic search (vector similarity) to find conceptually related emails
   - Keyword search for exact matches
3. **Context Retrieval**: The most relevant emails are retrieved and used as context
4. **AI Response**: GPT-4 generates a response based on the retrieved email context and your question

#### AI Features Requirements
To accomplish these AI features, the system:
- **Generates Embeddings**: Converts email content into high-dimensional vectors for semantic understanding
- **Maintains Search Index**: Uses Orama to store and search through email embeddings efficiently
- **Context Management**: Limits context to the most relevant emails to stay within token limits
- **Streaming Responses**: Provides real-time AI responses using OpenAI's streaming API
- **Credit System**: Tracks AI usage with 10 free credits per day for free users, unlimited for subscribers

### User Experience
- **Modern UI**: Beautiful, responsive interface built with Tailwind CSS and Radix UI
- **Dark Mode**: Full dark mode support with theme switching
- **Command Palette**: Quick navigation using KBar command palette
- **Resizable Panels**: Customizable layout with resizable panels for optimal workflow
- **Real-Time Updates**: Live updates as emails are synced

## Tech Stack

This project uses the [T3 Stack](https://create.t3.gg/):

- **Framework**: [Next.js](https://nextjs.org) 15 with App Router
- **Authentication**: [Clerk](https://clerk.com)
- **Database**: [PostgreSQL](https://www.postgresql.org/) with [Prisma](https://prisma.io) ORM
- **API Layer**: [tRPC](https://trpc.io) for type-safe APIs
- **Styling**: [Tailwind CSS](https://tailwindcss.com) with Radix UI components
- **Email Integration**: [Aurinko](https://aurinko.io) for email and calendar API
- **AI/ML**:
  - [OpenAI](https://openai.com) GPT-4 for chat responses
  - OpenAI Embeddings API for vector embeddings
  - [Orama](https://orama.sh) for vector search and indexing
- **Payments**: [Stripe](https://stripe.com) for subscription management
- **State Management**: [Jotai](https://jotai.org) and [TanStack Query](https://tanstack.com/query)

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL database
- OpenAI API key
- Aurinko API credentials
- Clerk authentication setup
- Stripe account (for subscriptions)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables (see `.env.example` for required variables)

4. Set up the database:
   ```bash
   npm run db:push
   ```

5. Run the development server:
   ```bash
   npm run dev
   ```

## Project Structure

- `/src/app` - Next.js app router pages and components
  - `/mail` - Email management interface
  - `/calendar` - Calendar view
  - `/api` - API routes (chat, webhooks, etc.)
- `/src/server` - Server-side code
  - `/api/routers` - tRPC routers
- `/src/lib` - Utility libraries
  - `embedding.ts` - OpenAI embeddings integration
  - `orama.ts` - Vector search client
  - `aurinko.ts` - Email/calendar API integration
- `/prisma` - Database schema and migrations

## Learn More

To learn more about the technologies used:

- [T3 Stack Documentation](https://create.t3.gg/)
- [Next.js Documentation](https://nextjs.org/docs)
- [tRPC Documentation](https://trpc.io/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Clerk Documentation](https://clerk.com/docs)
- [Orama Documentation](https://docs.orama.sh)

## Deployment

This project can be deployed to:
- [Vercel](https://vercel.com) (recommended for Next.js)
- [Netlify](https://netlify.com)
- [Docker](https://www.docker.com)

Make sure to configure all environment variables and database connections in your deployment environment.
