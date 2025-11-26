'use client'
import { Mail, FileText, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

export type Source = {
  type: 'email' | 'attachment'
  id: string
  title: string
  threadId?: string // For emails
}

type SourceCitationsProps = {
  sources: Source[]
  accountId: string
}

export function SourceCitations({ sources, accountId }: SourceCitationsProps) {
  if (sources.length === 0) return null

  return (
    <div className="mt-4 pt-3 border-t border-border/50">
      <div className="text-xs text-muted-foreground mb-2 font-medium">
        Sources:
      </div>
      <div className="flex flex-wrap gap-2">
        {sources.map((source) => (
          <Link
            key={`${source.type}-${source.id}`}
            href={
              source.type === 'email' && source.threadId
                ? `/mail?threadId=${source.threadId}&accountId=${accountId}`
                : `#` // For attachments, you might want to add a download/view page
            }
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs",
              "bg-muted hover:bg-muted/80 transition-colors",
              "border border-border"
            )}
          >
            {source.type === 'email' ? (
              <Mail className="size-3" />
            ) : (
              <FileText className="size-3" />
            )}
            <span className="truncate max-w-[200px]">{source.title}</span>
            <ExternalLink className="size-3 opacity-50" />
          </Link>
        ))}
      </div>
    </div>
  )
}

