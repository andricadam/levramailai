'use client'
import DOMPurify from 'isomorphic-dompurify'
import { Badge } from '@/components/ui/badge'
import { type ComponentProps } from 'react'
import useThreads from '@/hooks/use-threads'
import React from 'react'
import { format, differenceInDays } from 'date-fns'
import { type RouterOutputs } from '@/trpc/react'
import { cn } from '@/lib/utils'
import { Inbox, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { api } from '@/trpc/react'
import { useLocalStorage } from 'usehooks-ts'

type Thread = RouterOutputs["account"]["getThreads"][number]

// Mark as unread icon - envelope with notification dot
const MarkAsUnreadIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* Envelope outline */}
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    {/* Notification dot */}
    <circle cx="18" cy="6" r="3" fill="currentColor" />
  </svg>
);

const getPriorityBadgeVariant = (priority: 'high' | 'medium' | 'low' | undefined): ComponentProps<typeof Badge>['variant'] => {
    if (priority === 'high') return 'destructive'
    if (priority === 'low') return 'secondary'
    return 'default' // medium
}

const getPriorityLabel = (priority: 'high' | 'medium' | 'low' | undefined): string => {
    if (priority === 'high') return 'High'
    if (priority === 'low') return 'Low'
    return 'Medium'
}

const ThreadList = () => {
    const { threads, isFetching, threadId, setThreadId } = useThreads()
    const [mounted, setMounted] = React.useState(false)
    const [hoveredThreadId, setHoveredThreadId] = React.useState<string | null>(null)
    const [previewThreadId, setPreviewThreadId] = React.useState<string | null>(null)
    const [mousePosition, setMousePosition] = React.useState<{ x: number; y: number; side: 'left' | 'right' } | null>(null)
    const hoverTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)
    const lastMouseEventRef = React.useRef<React.MouseEvent<HTMLDivElement> | null>(null)
    const threadItemRefs = React.useRef<Map<string, HTMLButtonElement>>(new Map())
    const [accountId] = useLocalStorage('accountId', '')

    // Thread actions mutations
    const utils = api.useUtils()
    const archiveThread = api.mail.archiveThread.useMutation({
        onSuccess: () => {
            utils.account.getThreads.invalidate()
            utils.mail.getNumThreads.invalidate()
        }
    })

    const deleteThread = api.mail.deleteThread.useMutation({
        onSuccess: () => {
            utils.account.getThreads.invalidate()
            utils.mail.getNumThreads.invalidate()
        }
    })

    const markAsUnread = api.mail.markAsUnread.useMutation({
        onSuccess: () => {
            utils.account.getThreads.invalidate()
        }
    })

    React.useEffect(() => {
        setMounted(true)
    }, [])

    // Cleanup timeout on unmount
    React.useEffect(() => {
        return () => {
            if (hoverTimeoutRef.current) {
                clearTimeout(hoverTimeoutRef.current)
            }
        }
    }, [])

    // During SSR and initial hydration, show a consistent state
    if (!mounted) {
        return (
            <div className='w-full h-full'>
                <div className='flex flex-col gap-2 p-4 pt-0'>
                    <div className='text-sm text-muted-foreground'>Loading...</div>
                </div>
            </div>
        )
    }

    if (isFetching && (!threads || threads.length === 0)) {
        return (
            <div className='w-full h-full'>
                <div className='flex flex-col gap-2 p-4 pt-0'>
                    <div className='text-sm text-muted-foreground'>Loading...</div>
                </div>
            </div>
        )
    }

    if (!threads || threads.length === 0) {
        return (
            <div className='w-full h-full'>
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

    // Helper function to format date/time based on recency
    const formatEmailDate = (date: Date) => {
        const now = new Date()
        const emailDate = new Date(date)
        const daysDiff = differenceInDays(now, emailDate)
        
        // If email is within 1 week (7 days or less)
        if (daysDiff <= 7) {
            return {
                day: format(emailDate, 'EE'), // Two-letter day abbreviation (Mo, Tu, We, etc.)
                time: format(emailDate, 'HH:mm'), // Time in hh:mm format
                showTime: true
            }
        } else {
            // If email is older than 1 week, show only date
            return {
                date: format(emailDate, 'd. MMM'), // Format: "30. Nov"
                showTime: false
            }
        }
    }

    return (
        <div className='w-full h-full overflow-hidden'>
            <div className='flex flex-col gap-2 p-2 pt-0 w-full'>
                {Object.entries(groupedThreads).map(([date, threads]) => (
                    <React.Fragment key={date}>
                        <div className='text-xs font-medium text-muted-foreground mt-5 first:mt-0'>
                            {format(new Date(date + 'T00:00:00'), 'MMMM d, yyyy')}
                        </div>
                        {threads.map(thread => {
                            const emailDate = thread.emails.at(-1)?.sentAt ?? new Date()
                            const dateInfo = formatEmailDate(emailDate)
                            const isHovered = hoveredThreadId === thread.id
                            
                            const calculatePosition = (e: React.MouseEvent<HTMLDivElement>) => {
                                if (!e.currentTarget) return null
                                const threadItem = threadItemRefs.current.get(thread.id)
                                if (!threadItem) return null
                                const threadRect = threadItem.getBoundingClientRect()
                                const mouseX = e.clientX
                                const centerX = threadRect.left + threadRect.width / 2
                                const side: 'left' | 'right' = mouseX < centerX ? 'left' : 'right'
                                
                                // Calculate position with bounds checking
                                const popoverWidth = 384 // w-96 = 24rem = 384px
                                const padding = 10
                                let left = mouseX + padding
                                
                                // Y position is fixed to the bottom line of the thread item (button)
                                let top = threadRect.bottom
                                
                                // If cursor is on left side, show popover to the left of cursor
                                if (side === 'left') {
                                    left = mouseX - popoverWidth - padding
                                }
                                
                                // Ensure popover doesn't go off-screen horizontally
                                if (left < padding) {
                                    left = padding
                                } else if (left + popoverWidth > window.innerWidth - padding) {
                                    left = window.innerWidth - popoverWidth - padding
                                }
                                
                                // Ensure popover doesn't go off-screen vertically
                                // If too close to bottom, adjust so it fits
                                const popoverHeight = 400 // Approximate max height
                                if (top + popoverHeight > window.innerHeight - padding) {
                                    top = window.innerHeight - popoverHeight - padding
                                }
                                // If too close to top, keep it at top with padding
                                if (top < padding) {
                                    top = padding
                                }
                                
                                return { x: left, y: top, side }
                            }
                            
                            const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
                                lastMouseEventRef.current = e
                                const position = calculatePosition(e)
                                if (position) {
                                    setMousePosition(position)
                                }
                            }
                            
                            const handleMouseEnter = () => {
                                setHoveredThreadId(thread.id)
                                // Set preview after 1 second delay
                                if (hoverTimeoutRef.current) {
                                    clearTimeout(hoverTimeoutRef.current)
                                }
                                hoverTimeoutRef.current = setTimeout(() => {
                                    // Recalculate position when opening preview to ensure we have the latest thread item position
                                    // Use double requestAnimationFrame to ensure DOM is fully ready
                                    requestAnimationFrame(() => {
                                        requestAnimationFrame(() => {
                                            const threadItem = threadItemRefs.current.get(thread.id)
                                            if (threadItem && lastMouseEventRef.current) {
                                                const threadRect = threadItem.getBoundingClientRect()
                                                const mouseX = lastMouseEventRef.current.clientX
                                                const centerX = threadRect.left + threadRect.width / 2
                                                const side: 'left' | 'right' = mouseX < centerX ? 'left' : 'right'
                                                
                                                const popoverWidth = 384
                                                const padding = 10
                                                let left = mouseX + padding
                                                
                                                // Y position is fixed to the bottom line of the thread item (button)
                                                // Use the exact bottom coordinate
                                                let top = threadRect.bottom
                                                
                                                if (side === 'left') {
                                                    left = mouseX - popoverWidth - padding
                                                }
                                                
                                                // Bounds checking
                                                if (left < padding) {
                                                    left = padding
                                                } else if (left + popoverWidth > window.innerWidth - padding) {
                                                    left = window.innerWidth - popoverWidth - padding
                                                }
                                                
                                                const popoverHeight = 400
                                                if (top + popoverHeight > window.innerHeight - padding) {
                                                    top = window.innerHeight - popoverHeight - padding
                                                }
                                                if (top < padding) {
                                                    top = padding
                                                }
                                                
                                                setMousePosition({ x: left, y: top, side })
                                            }
                                            setPreviewThreadId(thread.id)
                                        })
                                    })
                                }, 1000)
                            }
                            
                            const handleMouseLeave = () => {
                                setHoveredThreadId(null)
                                setPreviewThreadId(null)
                                setMousePosition(null)
                                lastMouseEventRef.current = null
                                if (hoverTimeoutRef.current) {
                                    clearTimeout(hoverTimeoutRef.current)
                                }
                            }
                            
                            return (
                                <Popover 
                                    key={thread.id}
                                    open={previewThreadId === thread.id}
                                    onOpenChange={(open) => {
                                        if (!open) {
                                            setPreviewThreadId(null)
                                        }
                                    }}
                                >
                                    <div
                                        className="relative group"
                                        onMouseEnter={handleMouseEnter}
                                        onMouseLeave={handleMouseLeave}
                                        onMouseMove={handleMouseMove}
                                    >
                                        <PopoverTrigger asChild>
                                            <button 
                                                ref={(el) => {
                                                    if (el) {
                                                        threadItemRefs.current.set(thread.id, el)
                                                    } else {
                                                        threadItemRefs.current.delete(thread.id)
                                                    }
                                                }}
                                                onClick={() => setThreadId(thread.id)}
                                                className={cn(
                                                    'flex items-center gap-1.5 rounded-lg border p-5 text-left text-sm transition-all w-full max-w-full overflow-hidden min-h-[60px]',
                                                    'bg-[#fafafa] hover:bg-[#f0f0f0]',
                                                    threadId === thread.id && 'bg-accent'
                                                )}
                                            >
                                                {/* Left: Sender Name - Fixed Width */}
                                                <div className='font-semibold flex-shrink-0 w-[200px] truncate text-[15px]'>
                                                    {thread.emails.at(-1)?.from?.name || 'Unknown'}
                                                </div>
                                                
                                                {/* Center: Subject and Preview - Fixed alignment */}
                                                <div className='flex-1 flex flex-col gap-0.5 min-w-0 mr-2'>
                                                    {thread.subject && (
                                                        <div className='text-[12px] font-medium truncate'>{thread.subject}</div>
                                                    )}
                                                    {thread.emails.at(-1)?.bodySnippet && (
                                                        <div 
                                                            className='text-[10px] line-clamp-1 text-muted-foreground truncate'
                                                            dangerouslySetInnerHTML={{
                                                                __html: DOMPurify.sanitize(thread.emails.at(-1)?.bodySnippet ?? "", { USE_PROFILES: { html: true } })
                                                            }}
                                                        >
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                {/* Labels: User Label (top) and Priority Label (bottom) - Stacked vertically */}
                                                <div className='flex-shrink-0 flex flex-col gap-0.5 items-center justify-center w-[150px] -ml-2'>
                                                    {/* User Label - Display on top if exists */}
                                                    {thread.threadLabels && thread.threadLabels.length > 0 && thread.threadLabels[0]?.label && (
                                                        <Badge 
                                                            variant="secondary"
                                                            className='rounded-full text-[10px] px-1 py-0.5 leading-tight w-[60px] h-[20px] flex items-center justify-center'
                                                            style={{ 
                                                                backgroundColor: thread.threadLabels[0].label.color || undefined,
                                                                color: thread.threadLabels[0].label.color ? '#fff' : undefined
                                                            }}
                                                        >
                                                            <span className='truncate'>{thread.threadLabels[0].label.name}</span>
                                                        </Badge>
                                                    )}
                                                    
                                                    {/* Priority Label - Display below user label */}
                                                    {thread.emails.at(-1)?.priority && (
                                                        <Badge 
                                                            variant={getPriorityBadgeVariant(thread.emails.at(-1)?.priority)}
                                                            className='rounded-full text-[10px] px-1 py-0.5 leading-tight w-[60px] h-[20px] flex items-center justify-center text-white'
                                                        >
                                                            <span className='truncate'>{getPriorityLabel(thread.emails.at(-1)?.priority)}</span>
                                                        </Badge>
                                                    )}
                                                </div>
                                                
                                                {/* Right: Action Icons (shown on hover) or Date/Time */}
                                                <div className='flex-shrink-0 flex items-center gap-1 w-[55px] justify-end'>
                                                    {isHovered ? (
                                                        <div 
                                                            className='flex items-center gap-1' 
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                e.preventDefault()
                                                            }}
                                                        >
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <div
                                                                        role="button"
                                                                        tabIndex={0}
                                                                        className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-accent hover:text-accent-foreground cursor-pointer"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation()
                                                                            e.preventDefault()
                                                                            if (accountId && thread.id) {
                                                                                archiveThread.mutate({ accountId, threadId: thread.id })
                                                                            }
                                                                        }}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter' || e.key === ' ') {
                                                                                e.stopPropagation()
                                                                                e.preventDefault()
                                                                                if (accountId && thread.id) {
                                                                                    archiveThread.mutate({ accountId, threadId: thread.id })
                                                                                }
                                                                            }
                                                                        }}
                                                                    >
                                                                        <Inbox className="w-4 h-4" />
                                                                    </div>
                                                                </TooltipTrigger>
                                                                <TooltipContent>Archive</TooltipContent>
                                                            </Tooltip>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <div
                                                                        role="button"
                                                                        tabIndex={0}
                                                                        className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-accent hover:text-accent-foreground cursor-pointer"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation()
                                                                            e.preventDefault()
                                                                            if (accountId && thread.id) {
                                                                                deleteThread.mutate({ accountId, threadId: thread.id })
                                                                            }
                                                                        }}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter' || e.key === ' ') {
                                                                                e.stopPropagation()
                                                                                e.preventDefault()
                                                                                if (accountId && thread.id) {
                                                                                    deleteThread.mutate({ accountId, threadId: thread.id })
                                                                                }
                                                                            }
                                                                        }}
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </div>
                                                                </TooltipTrigger>
                                                                <TooltipContent>Delete</TooltipContent>
                                                            </Tooltip>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <div
                                                                        role="button"
                                                                        tabIndex={0}
                                                                        className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-accent hover:text-accent-foreground cursor-pointer"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation()
                                                                            e.preventDefault()
                                                                            if (accountId && thread.id) {
                                                                                markAsUnread.mutate({ accountId, threadId: thread.id })
                                                                            }
                                                                        }}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter' || e.key === ' ') {
                                                                                e.stopPropagation()
                                                                                e.preventDefault()
                                                                                if (accountId && thread.id) {
                                                                                    markAsUnread.mutate({ accountId, threadId: thread.id })
                                                                                }
                                                                            }
                                                                        }}
                                                                    >
                                                                        <MarkAsUnreadIcon className="w-4 h-4" />
                                                                    </div>
                                                                </TooltipTrigger>
                                                                <TooltipContent>Mark as unread</TooltipContent>
                                                            </Tooltip>
                                                        </div>
                                                    ) : (
                                                        <div className='text-right min-w-0'>
                                                            {dateInfo.showTime ? (
                                                                <div className='flex flex-col items-end'>
                                                                    <div className='text-[15px] font-medium leading-tight'>{dateInfo.day}</div>
                                                                    <div className='text-[12px] text-muted-foreground leading-tight'>{dateInfo.time}</div>
                                                                </div>
                                                            ) : (
                                                                <div className='text-[10px] text-muted-foreground leading-tight'>{dateInfo.date}</div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </button>
                                        </PopoverTrigger>
                                        
                                        {/* Email Preview Popover */}
                                        <PopoverContent 
                                            side={mousePosition?.side || "right"} 
                                            align="start"
                                            sideOffset={0}
                                            className="w-96 p-0 [&]:!transform-none [&]:!translate-x-0 [&]:!translate-y-0"
                                            onOpenAutoFocus={(e) => e.preventDefault()}
                                            style={
                                                mousePosition ? {
                                                    position: 'fixed',
                                                    left: `${mousePosition.x}px`,
                                                    top: `${mousePosition.y}px`,
                                                    transform: 'none',
                                                    margin: 0,
                                                    inset: 'auto'
                                                } : undefined
                                            }
                                        >
                                            <div className="p-4">
                                                <div className="mb-3">
                                                    <div className="font-semibold text-sm mb-1">
                                                        {thread.emails.at(-1)?.from?.name || 'Unknown'}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground mb-2">
                                                        {thread.subject || 'No subject'}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {format(emailDate, 'PPpp')}
                                                    </div>
                                                </div>
                                                <Separator className="my-3" />
                                                <div 
                                                    className="text-sm text-foreground max-h-64 overflow-y-auto"
                                                    dangerouslySetInnerHTML={{
                                                        __html: DOMPurify.sanitize(
                                                            thread.emails.at(-1)?.body ?? thread.emails.at(-1)?.bodySnippet ?? "", 
                                                            { USE_PROFILES: { html: true } }
                                                        )
                                                    }}
                                                />
                                            </div>
                                        </PopoverContent>
                                    </div>
                                </Popover>
                            )
                        })}
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