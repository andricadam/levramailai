import {
  Inbox,
  X,
  Clock,
  Forward,
  MoreVertical,
  Reply,
  ReplyAll,
  Trash2,
  ArrowLeft,
} from "lucide-react"
import {
  DropdownMenuContent,
  DropdownMenuItem,
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
  const dropdownMenuId = useId()
  const _thread = threads?.find(t => t.id === threadId)
  const [isSearching] = useAtom(isSearchingAtom)
  const [showReplyBox, setShowReplyBox] = React.useState(false)
  const [summary, setSummary] = React.useState<string>('')

  const [accountId] = useLocalStorage('accountId', '')
  const { data: foundThread } = api.mail.getThreadById.useQuery({
    accountId: accountId,
    threadId: threadId ?? ''
  }, { enabled: !_thread && !!threadId })
  const thread = _thread ?? foundThread

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
              <Button variant="ghost" size="icon" disabled={!thread}>
                <Inbox className="w-4 h-4" />
                <span className="sr-only">Archive</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Archive</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" disabled={!thread}>
                <X className="w-4 h-4" />
                <span className="sr-only">Move to junk</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Move to junk</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" disabled={!thread}>
                <Trash2 className="w-4 h-4" />
                <span className="sr-only">Move to trash</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Move to trash</TooltipContent>
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
        <Separator orientation="vertical" className="h-6 mx-2" />
        <DropdownMenu id={dropdownMenuId}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" disabled={!thread}>
              <MoreVertical className="w-4 h-4" />
              <span className="sr-only">More</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Mark as unread</DropdownMenuItem>
            <DropdownMenuItem>Star thread</DropdownMenuItem>
            <DropdownMenuItem>Add label</DropdownMenuItem>
            <DropdownMenuItem>Mute thread</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
                <div className="flex-shrink-0 max-h-[300px]">
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
    </div>
  )
}