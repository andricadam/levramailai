import {
  Inbox,
  Clock,
  Forward,
  Reply,
  ReplyAll,
  Trash2,
  ArrowLeft,
  Tag,
  Plus,
  Check,
  X,
} from "lucide-react"
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { api } from "@/trpc/react"
import { addDays, addHours, format, nextSaturday } from "date-fns"
import EmailDisplay from "./email-display"
import useThreads from "@/hooks/use-threads";
import { useAtom } from "jotai";
import { isSearchingAtom } from "./search-bar";
import SearchDisplay from "./search-display";
import { useLocalStorage } from "usehooks-ts";
import ReplyBox from "./reply-box";
import { useId } from "react";
import React from "react";
import { SummaryButton } from "./ai/summary";
import { ViewModeSelector, type ViewMode } from "./view-mode-selector";
import NewLabelDialog from "./new-label-dialog";

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

interface ThreadDisplayProps {
  currentViewMode?: ViewMode;
  onViewModeChange?: (view: ViewMode) => void;
  onFullscreen?: () => void;
  onSettingsClick?: () => void;
}

export function ThreadDisplay({
  currentViewMode = 'centered',
  onViewModeChange,
  onFullscreen,
  onSettingsClick,
}: ThreadDisplayProps = {}) {
  const { threads, threadId, setThreadId } = useThreads()
  const today = new Date()
  const popoverId = useId()
  const _thread = threads?.find(t => t.id === threadId)
  const [isSearching] = useAtom(isSearchingAtom)
  const [showReplyBox, setShowReplyBox] = React.useState(false)
  const [summary, setSummary] = React.useState<string>('')
  const [showLabelDialog, setShowLabelDialog] = React.useState(false)
  const [editingLabel, setEditingLabel] = React.useState<{ id: string; name: string; description?: string | null; color?: string } | null>(null)

  const [accountId] = useLocalStorage('accountId', '')
  const { data: foundThread } = api.mail.getThreadById.useQuery({
    accountId: accountId,
    threadId: threadId ?? ''
  }, { enabled: !_thread && !!threadId })
  const thread = _thread ?? foundThread

  // Label management
  const utils = api.useUtils()
  const { data: labels = [], isLoading: labelsLoading } = api.labels.getLabels.useQuery()
  const { data: threadLabels } = api.labels.getThreadLabels.useQuery(
    { threadId: threadId ?? '' },
    { enabled: !!threadId }
  )

  // Thread actions mutations
  const archiveThread = api.mail.archiveThread.useMutation({
    onSuccess: () => {
      utils.mail.getThreadById.invalidate()
      utils.account.getThreads.invalidate()
      utils.mail.getNumThreads.invalidate()
      setThreadId(null) // Close thread after archiving
    }
  })

  const deleteThread = api.mail.deleteThread.useMutation({
    onSuccess: () => {
      utils.mail.getThreadById.invalidate()
      utils.account.getThreads.invalidate()
      utils.mail.getNumThreads.invalidate()
      setThreadId(null) // Close thread after deleting
    }
  })

  const markAsUnread = api.mail.markAsUnread.useMutation({
    onSuccess: () => {
      utils.mail.getThreadById.invalidate()
      utils.account.getThreads.invalidate()
    }
  })
  const assignLabel = api.labels.assignLabelToThread.useMutation({
    onSuccess: () => {
      utils.mail.getThreadById.invalidate()
      utils.account.getThreads.invalidate()
      utils.labels.getThreadLabels.invalidate()
    }
  })
  const removeLabel = api.labels.removeLabelFromThread.useMutation({
    onSuccess: () => {
      utils.mail.getThreadById.invalidate()
      utils.account.getThreads.invalidate()
      utils.labels.getThreadLabels.invalidate()
    }
  })
  const createLabel = api.labels.createLabel.useMutation({
    onSuccess: () => {
      utils.labels.getLabels.invalidate()
      setShowLabelDialog(false)
      setEditingLabel(null)
    }
  })
  const updateLabel = api.labels.updateLabel.useMutation({
    onSuccess: () => {
      utils.labels.getLabels.invalidate()
      setEditingLabel(null)
      setShowLabelDialog(false)
    }
  })

  const handleCreateLabel = (name: string, description: string, color?: string) => {
    if (editingLabel) {
      updateLabel.mutate({
        id: editingLabel.id,
        name,
        description,
        ...(color && { color }),
      })
    } else {
      createLabel.mutate({
        name,
        description,
        color: color || '#6b7280',
      })
    }
  }

  const handleLabelSelect = (labelId: string) => {
    if (!threadId) return
    
    const isAssigned = threadLabels?.some(tl => tl.labelId === labelId) ?? false
    if (isAssigned) {
      removeLabel.mutate({ threadId, labelId })
    } else {
      assignLabel.mutate({ threadId, labelId })
    }
  }

  const isLabelAssigned = (labelId: string) => {
    return threadLabels?.some(tl => tl.labelId === labelId) ?? false
  }

  // Get the currently assigned label (first one)
  const currentLabel = threadLabels && threadLabels.length > 0 
    ? threadLabels[0]?.label 
    : null

  // Reset reply box and summary when thread changes
  React.useEffect(() => {
    setShowReplyBox(false)
    setSummary('')
  }, [threadId])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center p-2">
        {/* View Mode Selector - Top Left */}
        {onViewModeChange && onFullscreen && onSettingsClick && (
          <ViewModeSelector
            currentView={currentViewMode}
            onViewChange={onViewModeChange}
            onFullscreen={onFullscreen}
            onSettingsClick={onSettingsClick}
          />
        )}
        
        {/* Back Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setThreadId(null)}
              className="mr-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="sr-only">Back to inbox</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Back to inbox</TooltipContent>
        </Tooltip>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                disabled={!thread || archiveThread.isPending}
                onClick={() => {
                  if (threadId && accountId) {
                    archiveThread.mutate({ accountId, threadId })
                  }
                }}
              >
                <Inbox className="w-4 h-4" />
                <span className="sr-only">Archive</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Archive</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                disabled={!thread || markAsUnread.isPending}
                onClick={() => {
                  if (threadId && accountId) {
                    markAsUnread.mutate({ accountId, threadId })
                  }
                }}
              >
                <MarkAsUnreadIcon className="w-4 h-4" />
                <span className="sr-only">Mark as unread</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Mark as unread</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                disabled={!thread || deleteThread.isPending}
                onClick={() => {
                  if (threadId && accountId) {
                    deleteThread.mutate({ accountId, threadId })
                  }
                }}
              >
                <Trash2 className="w-4 h-4" />
                <span className="sr-only">Delete</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Delete</TooltipContent>
          </Tooltip>
          <Separator orientation="vertical" className="h-6 mx-1" />
          <Tooltip>
            <Popover id={popoverId}>
              <PopoverTrigger asChild>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" disabled={!thread}>
                    <Clock className="w-4 h-4" />
                    <span className="sr-only">Snooze</span>
                  </Button>
                </TooltipTrigger>
              </PopoverTrigger>
              <PopoverContent className="flex w-[535px] p-0">
                <div className="flex flex-col gap-2 px-2 py-4 border-r">
                  <div className="px-4 text-sm font-medium">Snooze until</div>
                  <div className="grid min-w-[250px] gap-1">
                    <Button
                      variant="ghost"
                      className="justify-start font-normal"
                    >
                      Later today{" "}
                      <span className="ml-auto text-muted-foreground">
                        {format(addHours(today, 4), "E, h:m b")}
                      </span>
                    </Button>
                    <Button
                      variant="ghost"
                      className="justify-start font-normal"
                    >
                      Tomorrow
                      <span className="ml-auto text-muted-foreground">
                        {format(addDays(today, 1), "E, h:m b")}
                      </span>
                    </Button>
                    <Button
                      variant="ghost"
                      className="justify-start font-normal"
                    >
                      This weekend
                      <span className="ml-auto text-muted-foreground">
                        {format(nextSaturday(today), "E, h:m b")}
                      </span>
                    </Button>
                    <Button
                      variant="ghost"
                      className="justify-start font-normal"
                    >
                      Next week
                      <span className="ml-auto text-muted-foreground">
                        {format(addDays(today, 7), "E, h:m b")}
                      </span>
                    </Button>
                  </div>
                </div>
                <div className="p-2">
                  <Calendar />
                </div>
              </PopoverContent>
            </Popover>
            <TooltipContent>Snooze</TooltipContent>
          </Tooltip>
          {/* Label Selector */}
          <Tooltip>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <TooltipTrigger asChild>
                  {currentLabel ? (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      disabled={!thread}
                      className="h-8 px-2 gap-1.5"
                    >
                      <Tag 
                        className="w-3.5 h-3.5 shrink-0"
                        style={{ color: currentLabel.color || '#6b7280' }}
                      />
                      <span className="text-xs font-medium">{currentLabel.name}</span>
                      <span className="sr-only">Change label</span>
                    </Button>
                  ) : (
                    <Button variant="ghost" size="icon" disabled={!thread}>
                      <Tag className="w-4 h-4" />
                      <span className="sr-only">Add label</span>
                    </Button>
                  )}
                </TooltipTrigger>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {labelsLoading ? (
                  <DropdownMenuItem disabled>Loading labels...</DropdownMenuItem>
                ) : labels.length === 0 ? (
                  <>
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      No labels yet
                    </div>
                    <DropdownMenuItem onClick={() => setShowLabelDialog(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create label
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <div className="px-2 py-1.5 text-sm font-medium text-foreground">
                      label hinzufügen
                    </div>
                    {labels.map((label) => (
                      <DropdownMenuItem
                        key={label.id}
                        onClick={() => handleLabelSelect(label.id)}
                        className="flex items-center gap-2"
                      >
                        <Tag 
                          className="w-4 h-4 shrink-0"
                          style={{ color: label.color || '#6b7280' }}
                        />
                        <span className="flex-1">{label.name}</span>
                        {isLabelAssigned(label.id) && (
                          <Check className="w-4 h-4" />
                        )}
                      </DropdownMenuItem>
                    ))}
                    {currentLabel && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => {
                            if (threadId && currentLabel.id) {
                              removeLabel.mutate({ threadId, labelId: currentLabel.id })
                            }
                          }}
                          className="text-destructive focus:text-destructive"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Remove label
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setShowLabelDialog(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create new label
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <TooltipContent>{currentLabel ? "Change label" : "Add label"}</TooltipContent>
          </Tooltip>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Tooltip>
            <TooltipTrigger asChild>
              <SummaryButton
                emailContent={thread?.emails?.[0]?.body ?? thread?.emails?.[0]?.bodySnippet ?? ''}
                subject={thread?.emails?.[0]?.subject ?? ''}
                from={thread?.emails?.[0]?.from?.name ?? thread?.emails?.[0]?.from?.address ?? 'Unknown'}
                sentAt={thread?.emails?.[0]?.sentAt ? format(new Date(thread.emails[0].sentAt), "PPpp") : ''}
                onSummaryGenerated={setSummary}
              />
            </TooltipTrigger>
            <TooltipContent>Summarize email</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant={showReplyBox ? "secondary" : "ghost"}
                size="icon" 
                disabled={!thread}
                onClick={() => setShowReplyBox(!showReplyBox)}
              >
                <Reply className="w-4 h-4" />
                <span className="sr-only">Reply</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{showReplyBox ? "Hide reply" : "Reply"}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" disabled={!thread}>
                <ReplyAll className="w-4 h-4" />
                <span className="sr-only">Reply all</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reply all</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" disabled={!thread}>
                <Forward className="w-4 h-4" />
                <span className="sr-only">Forward</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Forward</TooltipContent>
          </Tooltip>
        </div>
      </div>
      <Separator />
      {summary && (
        <div className="p-4 bg-muted/50 border-b">
          <div className="text-sm font-semibold mb-2 text-foreground">Summary</div>
          <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
            {summary}
          </div>
        </div>
      )}
      {isSearching ? <SearchDisplay /> : (
        thread ? (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="flex items-start p-4 flex-shrink-0">
              <div className="flex items-start gap-4 text-sm">
                <Avatar>
                  <AvatarImage alt={thread?.emails?.[0]?.from?.name ?? thread?.emails?.[0]?.from?.address ?? ''} />
                  <AvatarFallback>
                    {thread?.emails?.[0]?.from?.name?.split(" ")
                      .map((chunk: string) => chunk[0])
                      .join("") || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="grid gap-1">
                  <div className="font-semibold">{thread?.emails?.[0]?.from?.name || thread?.emails?.[0]?.from?.address || 'Unknown'}</div>
                  <div className="text-xs line-clamp-1">{thread?.emails?.[0]?.subject || 'No subject'}</div>
                  <div className="text-xs line-clamp-1">
                    <span className="font-medium">Reply-To:</span> {thread?.emails?.[0]?.from?.address || 'N/A'}
                  </div>
                </div>
              </div>
              {thread?.emails?.[0]?.sentAt && (
                <div className="ml-auto text-xs text-muted-foreground">
                  {format(new Date(thread.emails[0]?.sentAt ?? new Date()), "PPpp")}
                </div>
              )}
            </div>
            <Separator />
            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="p-4 flex flex-col gap-4">
                {thread?.emails?.map((email) => {
                  return <EmailDisplay key={email.id} email={email} />
                })}
              </div>
            </div>
            {showReplyBox && (
              <>
                <Separator className="flex-shrink-0" />
                <div className="flex-shrink-0">
                  <ReplyBox onSent={() => setShowReplyBox(false)} />
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="p-8 text-center text-muted-foreground">
            No message selected {threadId}
          </div>
        )
      )}
      <NewLabelDialog
        open={showLabelDialog}
        onOpenChange={(open) => {
          setShowLabelDialog(open)
          if (!open) {
            setEditingLabel(null)
          }
        }}
        onSubmit={handleCreateLabel}
        editLabel={editingLabel}
      />
    </div>
  )
}