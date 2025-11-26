'use client'
import { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { api } from '@/trpc/react'
import { Mail, X, Loader2, Paperclip } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

export type EmailContext = {
  emailId: string
  threadId: string
  subject: string
  from: string
  snippet: string
  sentAt: Date
  hasAttachments?: boolean
}

type EmailContextSelectorProps = {
  accountId: string
  selectedEmails: EmailContext[]
  onSelect: (email: EmailContext) => void
  onRemove: (emailId: string) => void
}

export function EmailContextSelector({
  accountId,
  selectedEmails,
  onSelect,
  onRemove,
}: EmailContextSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  // Query threads for selection - search across all tabs
  const { data: threads, isLoading } = api.account.searchThreadsForContext.useQuery(
    {
      accountId,
      search: searchQuery,
      limit: 20,
    },
    {
      enabled: isOpen && accountId.length > 0,
      staleTime: 30000, // Cache for 30 seconds
    }
  )

  const handleSelect = (thread: NonNullable<typeof threads>[number]) => {
    const lastEmail = thread.emails[thread.emails.length - 1]
    if (lastEmail && lastEmail.from) {
      // Check if already selected
      if (selectedEmails.some(e => e.emailId === lastEmail.id)) {
        return
      }

      onSelect({
        emailId: lastEmail.id,
        threadId: thread.id,
        subject: thread.subject,
        from: lastEmail.from.name || lastEmail.from.address || 'Unknown',
        snippet: lastEmail.bodySnippet || '',
        sentAt: lastEmail.sentAt,
        hasAttachments: lastEmail.hasAttachments || false,
      })
      setIsOpen(false)
      setSearchQuery('')
    }
  }

  return (
    <div className="flex flex-wrap gap-2 mb-2">
      {/* Selected email chips */}
      {selectedEmails.map((email) => (
        <div
          key={email.emailId}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-primary/10 text-sm border border-primary/20 group"
        >
          <Mail className="size-3.5 text-primary" />
          <span className="truncate max-w-[150px] font-medium">{email.subject}</span>
          {email.hasAttachments && (
            <Paperclip className="size-3 text-primary" title="Has attachments" />
          )}
          <button
            onClick={() => onRemove(email.emailId)}
            className="ml-0.5 hover:bg-primary/20 rounded p-0.5 transition-colors opacity-0 group-hover:opacity-100"
            aria-label="Remove email context"
          >
            <X className="size-3" />
          </button>
        </div>
      ))}

      {/* Add context button */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-dashed text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
          >
            <Mail className="size-3.5" />
            <span>Add email context</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[450px] p-0" align="start">
          <div className="p-3 border-b">
            <Input
              placeholder="Search emails by subject or sender..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              className="w-full"
            />
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : !threads || threads.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {searchQuery ? 'No emails found' : 'Start typing to search emails...'}
              </div>
            ) : (
              <div className="divide-y">
                {threads.map((thread) => {
                  const lastEmail = thread.emails[thread.emails.length - 1]
                  const isSelected = selectedEmails.some(
                    e => e.emailId === lastEmail?.id
                  )

                  if (!lastEmail || !lastEmail.from) return null

                  return (
                    <button
                      key={thread.id}
                      onClick={() => !isSelected && handleSelect(thread)}
                      disabled={isSelected}
                      className={cn(
                        'w-full text-left p-3 hover:bg-accent transition-colors',
                        isSelected && 'opacity-50 cursor-not-allowed bg-accent/50'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 font-medium text-sm truncate">
                            {thread.subject || '(No subject)'}
                            {lastEmail.hasAttachments && (
                              <Paperclip className="size-3 text-muted-foreground flex-shrink-0" title="Has attachments" />
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {lastEmail.from.name || lastEmail.from.address || 'Unknown'}
                          </div>
                          {lastEmail.bodySnippet && (
                            <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {lastEmail.bodySnippet}
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(lastEmail.sentAt, { addSuffix: true })}
                        </div>
                      </div>
                      {isSelected && (
                        <div className="text-xs text-primary mt-1">Already selected</div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

