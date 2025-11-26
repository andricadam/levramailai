/**
 * UI Knowledge Base for RAG System
 * Contains structured information about the application's interface and features
 * This allows the AI agent to answer questions about how to use the app
 */

export interface UIKnowledgeItem {
  id: string
  title: string
  category: string
  content: string
  keywords: string[]
  route?: string // URL route if applicable
  location?: string // Where to find it in the UI
}

export const UI_KNOWLEDGE_BASE: UIKnowledgeItem[] = [
  // Navigation & Main Pages
  {
    id: 'nav-mail',
    title: 'Mail Page',
    category: 'Navigation',
    content: `The Mail page is the main email management interface. You can access it by navigating to /mail. 
    
    Features:
    - View your inbox, drafts, sent emails, spam, and junk folders
    - Switch between different tabs using the sidebar
    - Search for emails using the search bar
    - Compose new emails using the compose button
    - View email threads and conversations
    - Use AI features like instant reply and email summary`,
    keywords: ['mail', 'inbox', 'email', 'messages', 'home', 'main page'],
    route: '/mail',
    location: 'Main navigation - Mail icon'
  },
  {
    id: 'nav-calendar',
    title: 'Calendar Page',
    category: 'Navigation',
    content: `The Calendar page shows your calendar events and meetings. Access it via /calendar.
    
    Features:
    - View calendar events synchronized with your email accounts
    - See upcoming meetings and appointments
    - Calendar data is automatically synced from your connected email accounts`,
    keywords: ['calendar', 'events', 'meetings', 'schedule', 'appointments'],
    route: '/calendar',
    location: 'Main navigation - Calendar icon'
  },
  {
    id: 'nav-settings',
    title: 'Settings Page',
    category: 'Navigation',
    content: `The Settings page allows you to manage your account and preferences. Access it via /settings.
    
    Sections:
    - General: App settings, language preferences
    - Account: Email account management
    - Privacy: Privacy and security settings
    - Billing: Subscription and payment management
    - Integrations: Connect apps like Google Drive, Google Calendar, SharePoint
    
    You can access settings from the main navigation or user menu.`,
    keywords: ['settings', 'preferences', 'configuration', 'account settings', 'options'],
    route: '/settings',
    location: 'Main navigation or user menu'
  },
  {
    id: 'nav-task-manager',
    title: 'Task Manager',
    category: 'Navigation',
    content: `The Task Manager helps you organize tasks and to-dos. Access it via /task-manager.
    
    Features:
    - Create and manage tasks
    - View tasks in different views (list, kanban, checkbox)
    - Organize tasks by status and priority`,
    keywords: ['tasks', 'todo', 'task manager', 'kanban', 'to-do list'],
    route: '/task-manager',
    location: 'Main navigation - Task Manager icon'
  },

  // Email Management Features
  {
    id: 'email-inbox',
    title: 'Inbox',
    category: 'Email Management',
    content: `The Inbox shows all your received emails. Access it from the Mail page sidebar.
    
    How to use:
    - Click on "Inbox" in the sidebar to view all incoming emails
    - Emails are organized in threads (conversations)
    - Click on a thread to view the full conversation
    - Use the search bar to find specific emails
    - Mark emails as done to archive them`,
    keywords: ['inbox', 'received emails', 'incoming', 'messages'],
    location: 'Mail page - Sidebar - Inbox tab'
  },
  {
    id: 'email-drafts',
    title: 'Drafts',
    category: 'Email Management',
    content: `Drafts contains emails you've started but haven't sent yet.
    
    How to access:
    - Click on "Drafts" in the Mail page sidebar
    - View all your draft emails
    - Click on a draft to continue editing and send it`,
    keywords: ['drafts', 'unsent', 'saved emails'],
    location: 'Mail page - Sidebar - Drafts tab'
  },
  {
    id: 'email-sent',
    title: 'Sent Emails',
    category: 'Email Management',
    content: `Sent shows all emails you've sent.
    
    How to access:
    - Click on "Sent" in the Mail page sidebar
    - View all your sent emails organized by date
    - Search through sent emails using the search bar`,
    keywords: ['sent', 'outgoing', 'sent emails'],
    location: 'Mail page - Sidebar - Sent tab'
  },
  {
    id: 'email-compose',
    title: 'Compose New Email',
    category: 'Email Management',
    content: `To compose a new email:
    
    1. Click the "Compose" button (usually in the top right or sidebar)
    2. A rich text editor will open
    3. Enter recipient email addresses in the "To" field
    4. Add a subject line
    5. Write your email using the rich text editor
    6. Use AI features like AI Compose for help writing
    7. Click "Send" to send the email
    
    Features:
    - Rich text formatting (bold, italic, lists, etc.)
    - AI-powered composition assistance
    - Attach files
    - Add CC and BCC recipients`,
    keywords: ['compose', 'new email', 'write email', 'send email', 'create email'],
    location: 'Mail page - Compose button'
  },
  {
    id: 'email-reply',
    title: 'Reply to Email',
    category: 'Email Management',
    content: `To reply to an email:
    
    1. Open the email thread you want to reply to
    2. Click the "Reply" button in the email view
    3. A reply box will appear with the original email quoted
    4. Write your reply
    5. Use "Instant Reply" (lightning bolt icon) for AI-generated replies
    6. Click "Send" to send your reply
    
    You can also:
    - Reply to all recipients
    - Forward the email
    - Use AI to generate instant replies`,
    keywords: ['reply', 'respond', 'answer email', 'instant reply'],
    location: 'Email thread view - Reply button'
  },
  {
    id: 'email-search',
    title: 'Search Emails',
    category: 'Email Management',
    content: `Search for emails using the search bar:
    
    How to search:
    1. Use the search bar at the top of the Mail page
    2. Type keywords, sender names, or subjects
    3. Results will show matching emails and threads
    4. Click on a result to open it
    
    Search capabilities:
    - Search by subject
    - Search by sender name or email
    - Search by content
    - Full-text search across all emails`,
    keywords: ['search', 'find email', 'search emails', 'look for'],
    location: 'Mail page - Top search bar'
  },
  {
    id: 'email-account-switch',
    title: 'Switch Email Accounts',
    category: 'Email Management',
    content: `If you have multiple email accounts connected, you can switch between them:
    
    How to switch:
    1. Look for the account switcher (usually in the top navigation)
    2. Click on it to see all connected accounts
    3. Select the account you want to use
    4. The interface will update to show emails from that account
    
    You can connect multiple email accounts in Settings > Account.`,
    keywords: ['switch account', 'change account', 'multiple accounts', 'account switcher'],
    location: 'Top navigation - Account switcher'
  },

  // AI Features
  {
    id: 'ai-ask-ai',
    title: 'Ask AI Assistant',
    category: 'AI Features',
    content: `The Ask AI feature lets you ask questions about your emails using natural language.
    
    How to use:
    1. Click the Ask AI button (floating button in bottom right, or in navigation)
    2. A chat interface will open
    3. Type your question about your emails
    4. The AI will search through your emails and provide an answer
    
    Features:
    - Ask questions like "When is my next meeting?" or "What emails did I get from John?"
    - Add email context by selecting specific emails
    - Attach files to include in your question
    - Enable web search for current information
    - View sources used in the answer
    
    Examples:
    - "Summarize my unread emails"
    - "When is my next flight?"
    - "What did Sarah say about the project?"
    - "Show me emails about invoices"`,
    keywords: ['ask ai', 'ai assistant', 'chat', 'question', 'help', 'how to'],
    location: 'Floating button (bottom right) or navigation'
  },
  {
    id: 'ai-instant-reply',
    title: 'Instant Reply (AI)',
    category: 'AI Features',
    content: `Instant Reply uses AI to generate email replies automatically.
    
    How to use:
    1. Open an email thread you want to reply to
    2. Click the lightning bolt icon (⚡) - Instant Reply button
    3. AI will analyze the email conversation
    4. A reply will be generated automatically
    5. Review and edit if needed
    6. Send the reply
    
    The AI considers:
    - The email conversation context
    - Your writing style
    - The tone and content of the original email`,
    keywords: ['instant reply', 'ai reply', 'auto reply', 'quick reply', 'lightning'],
    location: 'Email thread view - Lightning bolt icon'
  },
  {
    id: 'ai-compose',
    title: 'AI Compose',
    category: 'AI Features',
    content: `AI Compose helps you write emails using AI assistance.
    
    How to use:
    1. Start composing a new email
    2. Click the AI Compose button in the editor
    3. Describe what you want to write
    4. AI will generate the email content
    5. Edit and customize as needed
    6. Send the email
    
    You can ask for:
    - Professional emails
    - Casual messages
    - Specific tones or styles
    - Email templates`,
    keywords: ['ai compose', 'ai write', 'generate email', 'ai assistance'],
    location: 'Email composer - AI Compose button'
  },
  {
    id: 'ai-autocomplete',
    title: 'AI Autocomplete',
    category: 'AI Features',
    content: `AI Autocomplete suggests text as you type in the email editor.
    
    How it works:
    - As you type, AI suggests completions
    - Press Tab to accept a suggestion
    - Continue typing to get more suggestions
    - Suggestions are based on context and your writing style`,
    keywords: ['autocomplete', 'ai suggestions', 'ghost text', 'predictions'],
    location: 'Email editor - Automatic while typing'
  },
  {
    id: 'ai-summary',
    title: 'Email Summary',
    category: 'AI Features',
    content: `Get AI-generated summaries of email threads.
    
    How to use:
    1. Open an email thread
    2. Click the Summary button
    3. AI will generate a concise summary of the conversation
    4. View key points and action items
    
    Useful for:
    - Long email threads
    - Catching up on conversations
    - Quick overview of discussions`,
    keywords: ['summary', 'summarize', 'overview', 'key points'],
    location: 'Email thread view - Summary button'
  },
  {
    id: 'ai-context-selector',
    title: 'Add Email Context to AI Questions',
    category: 'AI Features',
    content: `When asking the AI a question, you can add specific emails as context.
    
    How to use:
    1. Open Ask AI chat
    2. Click "Add email context" button
    3. Search for and select specific emails
    4. The AI will use those emails to answer your question
    
    This is useful when:
    - You want to ask about specific emails
    - You need context from particular conversations
    - You want to reference multiple related emails`,
    keywords: ['email context', 'add context', 'select emails', 'reference'],
    location: 'Ask AI chat - Add email context button'
  },
  {
    id: 'ai-file-attachment',
    title: 'Attach Files to AI Questions',
    category: 'AI Features',
    content: `You can attach files when asking the AI questions.
    
    How to use:
    1. Open Ask AI chat
    2. Click the file attachment button (paperclip icon)
    3. Select a file to upload (PDF, DOCX, TXT, images up to 10MB)
    4. Toggle "Add to knowledge base" if you want it permanently indexed
    5. Ask your question - AI will use the file content
    
    Supported formats:
    - PDF documents
    - Word documents (DOCX)
    - Text files
    - Images (with OCR for text extraction)
    
    Files can be:
    - Temporary (only for current question)
    - Permanent (added to knowledge base for future searches)`,
    keywords: ['attach file', 'upload', 'file attachment', 'document', 'pdf'],
    location: 'Ask AI chat - File attachment button'
  },
  {
    id: 'ai-web-search',
    title: 'Web Search in AI',
    category: 'AI Features',
    content: `Enable web search to get current information in AI answers.
    
    How to use:
    1. Open Ask AI chat
    2. Toggle "Web search" switch (globe icon)
    3. Ask your question
    4. AI will search the web and include current information
    
    Use web search for:
    - Current events
    - Recent information
    - General knowledge questions
    - Information not in your emails`,
    keywords: ['web search', 'internet search', 'google', 'current information'],
    location: 'Ask AI chat - Web search toggle'
  },

  // Settings & Configuration
  {
    id: 'settings-general',
    title: 'General Settings',
    category: 'Settings',
    content: `General settings allow you to configure app preferences.
    
    Access: Settings > General
    
    Options include:
    - Language preferences
    - Theme settings (light/dark mode)
    - Default behaviors
    - UI preferences`,
    keywords: ['general settings', 'preferences', 'app settings', 'configuration'],
    route: '/settings?view=general',
    location: 'Settings page - General tab'
  },
  {
    id: 'settings-account',
    title: 'Account Settings',
    category: 'Settings',
    content: `Manage your email accounts and account settings.
    
    Access: Settings > Account
    
    You can:
    - View connected email accounts
    - Add new email accounts
    - Remove accounts
    - Manage account details`,
    keywords: ['account', 'email accounts', 'manage accounts', 'add account'],
    route: '/settings?view=account',
    location: 'Settings page - Account tab'
  },
  {
    id: 'settings-integrations',
    title: 'App Integrations',
    category: 'Settings',
    content: `Connect external apps to make their content searchable in AI.
    
    Access: Settings > Integrations
    
    Available integrations:
    - Google Drive: Access your Google Drive documents
    - Google Calendar: Access your calendar events
    - SharePoint: Access your SharePoint documents
    
    How to connect:
    1. Go to Settings > Integrations
    2. Click "Connect" on the app you want
    3. Complete OAuth authentication
    4. Content will be synced and searchable
    
    Features:
    - Enable/disable integrations
    - Manual sync
    - View sync status
    - Disconnect integrations`,
    keywords: ['integrations', 'connect apps', 'google drive', 'sharepoint', 'calendar integration'],
    route: '/settings?view=integrations',
    location: 'Settings page - Integrations tab'
  },
  {
    id: 'settings-privacy',
    title: 'Privacy Settings',
    category: 'Settings',
    content: `Manage your privacy and security settings.
    
    Access: Settings > Privacy
    
    Options include:
    - Privacy preferences
    - Data management
    - Security settings`,
    keywords: ['privacy', 'security', 'data', 'privacy settings'],
    route: '/settings?view=privacy',
    location: 'Settings page - Privacy tab'
  },
  {
    id: 'settings-billing',
    title: 'Billing & Subscription',
    category: 'Settings',
    content: `Manage your subscription and billing.
    
    Access: Settings > Billing
    
    You can:
    - View subscription status
    - Manage payment methods
    - Upgrade or downgrade plans
    - View billing history
    
    Plans:
    - Free: 10 AI credits per day
    - Premium: Unlimited AI usage`,
    keywords: ['billing', 'subscription', 'payment', 'premium', 'upgrade'],
    route: '/settings?view=billing',
    location: 'Settings page - Billing tab'
  },

  // Keyboard Shortcuts & Commands
  {
    id: 'shortcuts-command-palette',
    title: 'Command Palette (KBar)',
    category: 'Keyboard Shortcuts',
    content: `Use the command palette for quick navigation and actions.
    
    How to open:
    - Press Cmd+K (Mac) or Ctrl+K (Windows/Linux)
    - Or click the command icon in navigation
    
    You can:
    - Navigate to different pages
    - Switch accounts
    - Toggle theme
    - Search for features
    - Execute quick actions`,
    keywords: ['command palette', 'kbar', 'shortcuts', 'cmd+k', 'ctrl+k', 'quick actions'],
    location: 'Keyboard shortcut: Cmd+K / Ctrl+K'
  },
  {
    id: 'shortcuts-compose',
    title: 'Quick Compose',
    category: 'Keyboard Shortcuts',
    content: `Quick ways to compose emails:
    - Click the Compose button
    - Use command palette (Cmd+K) and search "compose"
    - Navigate to Mail page and use compose button`,
    keywords: ['compose shortcut', 'new email', 'quick compose'],
    location: 'Mail page or Command palette'
  },

  // Common Questions
  {
    id: 'faq-where-is-x',
    title: 'Finding Features',
    category: 'Help',
    content: `Common locations for features:
    
    - Email management: /mail page
    - Calendar: /calendar page
    - Tasks: /task-manager page
    - Settings: /settings page
    - Ask AI: Floating button (bottom right) or navigation
    - Account switching: Top navigation
    - Search: Search bar at top of Mail page
    
    Use the command palette (Cmd+K) to quickly find any feature.`,
    keywords: ['where is', 'how to find', 'location', 'where can I'],
    location: 'Various - Use command palette for quick access'
  },
  {
    id: 'faq-how-to-use',
    title: 'How to Use the App',
    category: 'Help',
    content: `Getting started guide:
    
    1. Connect your email account in Settings > Account
    2. Navigate to Mail page to see your emails
    3. Use Ask AI (bottom right button) to ask questions about your emails
    4. Compose emails using the Compose button
    5. Use AI features like Instant Reply for quick responses
    6. Connect integrations in Settings > Integrations for more AI capabilities
    
    The app automatically syncs your emails and makes them searchable.`,
    keywords: ['how to use', 'getting started', 'tutorial', 'guide', 'help'],
    location: 'App-wide'
  },
  {
    id: 'faq-ai-credits',
    title: 'AI Credits & Limits',
    category: 'Help',
    content: `AI usage limits:
    
    Free users:
    - 10 AI credits per day
    - Credits reset daily
    - Includes Ask AI, Instant Reply, AI Compose, etc.
    
    Premium users:
    - Unlimited AI usage
    - No daily limits
    
    Upgrade in Settings > Billing to get unlimited access.`,
    keywords: ['credits', 'limits', 'free', 'premium', 'upgrade', 'subscription'],
    location: 'Settings > Billing'
  },
]

/**
 * Get all UI knowledge items as a single text document for indexing
 */
export function getUIKnowledgeBaseText(): string {
  return UI_KNOWLEDGE_BASE.map(item => 
    `[${item.category}] ${item.title}\n\n${item.content}\n\nLocation: ${item.location || 'N/A'}\nRoute: ${item.route || 'N/A'}\nKeywords: ${item.keywords.join(', ')}`
  ).join('\n\n---\n\n')
}

/**
 * Search UI knowledge base by keywords
 */
export function searchUIKnowledge(query: string): UIKnowledgeItem[] {
  const lowerQuery = query.toLowerCase()
  return UI_KNOWLEDGE_BASE.filter(item => 
    item.title.toLowerCase().includes(lowerQuery) ||
    item.content.toLowerCase().includes(lowerQuery) ||
    item.keywords.some(keyword => keyword.toLowerCase().includes(lowerQuery)) ||
    item.category.toLowerCase().includes(lowerQuery)
  )
}

