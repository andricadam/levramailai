"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight, PlusIcon } from "lucide-react"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isSameDay, isToday } from "date-fns"
import { Button } from "@/components/ui/button"
import { api } from "@/trpc/react"
import { cn } from "@/lib/utils"
import { NoCalendarMessage } from "./no-calendar-message"
import { useLocalStorage } from "usehooks-ts"
import { CreateEventDialog } from "../create-event-dialog"

type CalendarEvent = {
  id: string
  title: string
  start: string
  end: string
  location?: string
}

export function MonthlyView() {
  const [currentDate, setCurrentDate] = React.useState(new Date())
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false)
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }) // Monday
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  // Fetch events for the current month
  const startOfMonthISO = monthStart.toISOString()
  const endOfMonthISO = endOfMonth(currentDate).toISOString()

  // Get the currently selected account ID
  const [accountId] = useLocalStorage('accountId', '')

  const { data: events = [], isLoading } = api.calendar.getEvents.useQuery({
    startDate: startOfMonthISO,
    endDate: endOfMonthISO,
    accountId: accountId || undefined,
  })

  const { data: connections = [] } = api.integrations.getConnections.useQuery()
  // Check for calendar connection for the current account
  const hasCalendarConnection = connections.some(
    (conn) => 
      (conn.appType === 'google_calendar' || conn.appType === 'microsoft_calendar') && 
      conn.enabled &&
      (!accountId || conn.accountId === accountId)
  )

  // Group events by date and sort by time
  // IMPORTANT: All hooks must be called before any conditional returns
  const eventsByDate = React.useMemo(() => {
    const grouped: Record<string, CalendarEvent[]> = {}
    events.forEach((event) => {
      // Extract date in local timezone to avoid timezone shift issues
      const eventDateObj = new Date(event.start)
      const year = eventDateObj.getFullYear()
      const month = String(eventDateObj.getMonth() + 1).padStart(2, '0')
      const day = String(eventDateObj.getDate()).padStart(2, '0')
      const eventDate = `${year}-${month}-${day}`
      if (!grouped[eventDate]) {
        grouped[eventDate] = []
      }
      grouped[eventDate].push(event)
    })
    // Sort events within each day by start time
    Object.keys(grouped).forEach((date) => {
      grouped[date].sort((a, b) => 
        new Date(a.start).getTime() - new Date(b.start).getTime()
      )
    })
    return grouped
  }, [events])

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })
  const weekDays = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]

  if (!hasCalendarConnection) {
    return <NoCalendarMessage />
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev)
      newDate.setMonth(prev.getMonth() + (direction === 'next' ? 1 : -1))
      return newDate
    })
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold">
            {format(currentDate, "MMMM yyyy", { locale: undefined })}
          </h2>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigateMonth('prev')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigateMonth('next')}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setCreateDialogOpen(true)}
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Create
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
          {/* Weekday headers */}
          {weekDays.map((day) => (
            <div
              key={day}
              className="bg-muted/50 p-2 text-center text-sm font-semibold text-foreground border-b"
            >
              {day}
            </div>
          ))}

          {/* Calendar days */}
          {days.map((day, dayIdx) => {
            // Extract date in local timezone to avoid timezone shift issues
            const year = day.getFullYear()
            const month = String(day.getMonth() + 1).padStart(2, '0')
            const dayNum = String(day.getDate()).padStart(2, '0')
            const dayStr = `${year}-${month}-${dayNum}`
            const dayEvents = eventsByDate[dayStr] || []
            const isCurrentMonth = isSameMonth(day, currentDate)
            const isCurrentDay = isToday(day)

            return (
              <div
                key={dayIdx}
                className={cn(
                  "bg-background min-h-[120px] p-1.5 border-r border-b hover:bg-muted/30 transition-colors",
                  !isCurrentMonth && "text-muted-foreground bg-muted/20",
                  isCurrentDay && !isCurrentMonth && "bg-primary/5"
                )}
              >
                <div
                  className={cn(
                    "text-sm font-medium mb-1.5 p-1 rounded w-7 h-7 flex items-center justify-center",
                    isCurrentDay && "bg-primary text-primary-foreground font-semibold"
                  )}
                >
                  {format(day, "d")}
                </div>
                <div className="space-y-0.5 max-h-[90px] overflow-y-auto">
                  {dayEvents.slice(0, 3).map((event) => {
                    const eventStart = new Date(event.start)
                    const timeStr = format(eventStart, "HH:mm")
                    return (
                      <div
                        key={event.id}
                        className="text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100 truncate cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-900/50 border-l-2 border-blue-500 transition-colors"
                        title={`${timeStr} - ${event.title}${event.location ? ` @ ${event.location}` : ''}`}
                      >
                        <span className="font-medium">{timeStr}</span> {event.title}
                      </div>
                    )
                  })}
                  {dayEvents.length > 3 && (
                    <div className="text-xs text-muted-foreground px-1.5 py-0.5 cursor-pointer hover:text-foreground hover:bg-muted/50 rounded">
                      +{dayEvents.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <CreateEventDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </div>
  )
}

