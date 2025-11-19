'use client'
import DOMPurify from 'isomorphic-dompurify'
import { Badge } from '@/components/ui/badge'
import { type ComponentProps } from 'react'
import useThreads from '@/hooks/use-threads'
import React from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import { type RouterOutputs } from '@/trpc/react'
import { cn } from '@/lib/utils'

type Thread = RouterOutputs["account"]["getThreads"][number]

const ThreadList = () => {
    const { threads, isFetching, threadId, setThreadId } = useThreads()
    const [mounted, setMounted] = React.useState(false)

    React.useEffect(() => {
        setMounted(true)
    }, [])

    // During SSR and initial hydration, show a consistent state
    if (!mounted) {
        return (
            <div className='max-w-full overflow-y-scroll max-h-[calc(100vh-120px)]'>
                <div className='flex flex-col gap-2 p-4 pt-0'>
                    <div className='text-sm text-muted-foreground'>Loading...</div>
                </div>
            </div>
        )
    }

    if (isFetching && (!threads || threads.length === 0)) {
        return (
            <div className='max-w-full overflow-y-scroll max-h-[calc(100vh-120px)]'>
                <div className='flex flex-col gap-2 p-4 pt-0'>
                    <div className='text-sm text-muted-foreground'>Loading...</div>
                </div>
            </div>
        )
    }

    if (!threads || threads.length === 0) {
        return (
            <div className='max-w-full overflow-y-scroll max-h-[calc(100vh-120px)]'>
                <div className='flex flex-col gap-2 p-4 pt-0'>
                    <div className='text-sm text-muted-foreground'>No threads found</div>
                </div>
            </div>
        )
    }

    const groupedThreads = threads.reduce((acc: Record<string, Thread[]>, thread: Thread) => {
        const date = format(thread.lastMessageDate ?? new Date(), 'yyyy-MM-dd')
        if (!acc[date]) {
            acc[date] = []
        }
        acc[date]!.push(thread)
        return acc
    }, {} as Record<string, Thread[]>)

    return (
        <div className='max-w-full overflow-y-scroll max-h-[calc(100vh-120px)]'>
            <div className='flex flex-col gap-2 p-4 pt-0'>
                {Object.entries(groupedThreads).map(([date, threads]) => (
                    <React.Fragment key={date}>
                        <div className='text-xs font-medium text-muted-foreground mt-5 first:mt-0'>
                            {format(new Date(date + 'T00:00:00'), 'MMMM d, yyyy')}
                        </div>
                        {threads.map(thread => (
                            <button onClick={() => setThreadId(thread.id)}
                                key={thread.id} 
                                className={cn(
                                    'flex flex-col items-start gap-2 rounded-lg border p-3 text-left text-sm transition-all hover:bg-accent w-full',
                                    threadId === thread.id && 'bg-accent'
                                )}
                            >
                                <div className='flex items-center w-full'>
                                    <div className='font-semibold'>
                                        {thread.emails.at(-1)?.from?.name || 'Unknown'}
                                    </div>
                                    <div className={cn('ml-auto text-xs text-muted-foreground')}>
                                        {formatDistanceToNow(
                                            thread.emails.at(-1)?.sentAt ?? new Date(), 
                                            { addSuffix: true }
                                        )}
                                    </div>
                                </div>
                                {thread.subject && (
                                    <div className='text-xs font-medium'>{thread.subject}</div>
                                )}
                                {thread.emails.at(-1)?.bodySnippet && (
                                    <div 
                                        className='text-xs line-clamp-2 text-muted-foreground'
                                        dangerouslySetInnerHTML={{
                                            __html: DOMPurify.sanitize(thread.emails.at(-1)?.bodySnippet ?? "", { USE_PROFILES: { html: true } })
                                        }}
                                    >
                                    </div>
                                )}
                                {thread.emails[0]?.sysLabels && (thread.emails[0].sysLabels.length > 0) && (
                                    <div className='flex items-center gap-2'>
                                        {thread.emails[0]?.sysLabels.map(label => {
                                            return <Badge key={label} variant={getBadgeVariantFromLabel(label)}>
                                                {label}
                                            </Badge>
                                        })}
                                    </div>
                                )}
                            </button>
                        ))}
                    </React.Fragment>
                ))}
            </div>
        </div>
    )
}

function getBadgeVariantFromLabel(label: string): ComponentProps<typeof Badge>['variant'] {
    if (['work'].includes(label.toLowerCase())) {
        return 'default'
    }
    return 'secondary'
}

export default ThreadList