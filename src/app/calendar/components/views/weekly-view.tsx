"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight, PlusIcon } from "lucide-react"
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, isSameDay, isToday } from "date-fns"
import { Button } from "@/components/ui/button"
import { api } from "@/trpc/react"
import { cn } from "@/lib/utils"
import { formatDateRange } from "little-date"
import { NoCalendarMessage } from "./no-calendar-message"
import { useLocalStorage } from "usehooks-ts"
import { CreateEventDialog } from "../create-event-dialog"

export function WeeklyView() {
  const [currentDate, setCurrentDate] = React.useState(new Date())
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false)
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }) // Monday
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 })
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })

  // Fetch events for the week
  const startOfWeekISO = weekStart.toISOString()
  const endOfWeekISO = weekEnd.toISOString()

  // Get the currently selected account ID
  const [accountId] = useLocalStorage('accountId', '')

  const { data: events = [] } = api.calendar.getEvents.useQuery({
    startDate: startOfWeekISO,
    endDate: endOfWeekISO,
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

  // IMPORTANT: All hooks must be called before any conditional returns
  // Group events by date and separate all-day events
  const eventsByDate = React.useMemo(() => {
    const grouped: Record<string, typeof events> = {}
    events.forEach((event) => {
      // Extract date in local timezone to avoid timezone shift issues
      // For all-day events, start is already in YYYY-MM-DD format
      let eventDate: string
      if (event.allDay) {
        eventDate = event.start.split('T')[0] // Already in YYYY-MM-DD format
      } else {
        const eventDateObj = new Date(event.start)
        const year = eventDateObj.getFullYear()
        const month = String(eventDateObj.getMonth() + 1).padStart(2, '0')
        const day = String(eventDateObj.getDate()).padStart(2, '0')
        eventDate = `${year}-${month}-${day}`
      }
      if (!grouped[eventDate]) {
        grouped[eventDate] = []
      }
      grouped[eventDate].push(event)
    })
    return grouped
  }, [events])

  // Separate all-day events from timed events
  const allDayEventsByDate = React.useMemo(() => {
    const grouped: Record<string, typeof events> = {}
    const timedEventsByDate: Record<string, typeof events> = {}
    
    Object.keys(eventsByDate).forEach((date) => {
      const allDay: typeof events = []
      const timed: typeof events = []
      
      eventsByDate[date].forEach((event) => {
        if (event.allDay) {
          allDay.push(event)
        } else {
          timed.push(event)
        }
      })
      
      if (allDay.length > 0) {
        grouped[date] = allDay
      }
      if (timed.length > 0) {
        timedEventsByDate[date] = timed
      }
    })
    
    return { allDay: grouped, timed: timedEventsByDate }
  }, [eventsByDate])

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentDate((prev) => 
      direction === 'next' ? addWeeks(prev, 1) : subWeeks(prev, 1)
    )
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const hours = Array.from({ length: 24 }, (_, i) => i)

  if (!hasCalendarConnection) {
    return <NoCalendarMessage />
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold">
            {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
          </h2>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigateWeek('prev')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigateWeek('next')}
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

      {/* Week Grid */}
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-8 h-full">
          {/* Time column */}
          <div className="border-r bg-muted/30">
            <div className="h-16 border-b"></div>
            {hours.map((hour) => (
              <div
                key={hour}
                className="h-16 border-b text-xs text-muted-foreground px-2 pt-1"
              >
                {format(new Date().setHours(hour, 0, 0, 0), "HH:mm")}
              </div>
            ))}
          </div>

          {/* Days */}
          {weekDays.map((day, dayIdx) => {
            // Extract date in local timezone to avoid timezone shift issues
            const year = day.getFullYear()
            const month = String(day.getMonth() + 1).padStart(2, '0')
            const dayNum = String(day.getDate()).padStart(2, '0')
            const dayStr = `${year}-${month}-${dayNum}`
            const dayAllDayEvents = allDayEventsByDate.allDay[dayStr] || []
            const dayTimedEvents = allDayEventsByDate.timed[dayStr] || []
            const isCurrentDay = isToday(day)

            return (
              <div key={dayIdx} className="flex-1 border-r">
                {/* Day header */}
                <div
                  className={cn(
                    "h-16 border-b p-2 text-center",
                    isCurrentDay && "bg-primary/10"
                  )}
                >
                  <div className="text-xs text-muted-foreground">
                    {format(day, "EEE")}
                  </div>
                  <div
                    className={cn(
                      "text-lg font-semibold",
                      isCurrentDay && "bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center mx-auto"
                    )}
                  >
                    {format(day, "d")}
                  </div>
                </div>

                {/* All-day events bar */}
                {dayAllDayEvents.length > 0 && (
                  <div className="border-b bg-muted/20 px-1 py-0.5 space-y-0.5">
                    {dayAllDayEvents.map((event) => {
                      // Check if event spans multiple days
                      const startDate = event.start.split('T')[0]
                      const endDate = event.end.split('T')[0]
                      const eventStart = new Date(startDate)
                      const eventEnd = new Date(endDate)
                      const daysDiff = Math.ceil((eventEnd.getTime() - eventStart.getTime()) / (1000 * 60 * 60 * 24))
                      const isMultiDay = daysDiff > 1
                      
                      return (
                        <div
                          key={event.id}
                          className="rounded bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 px-2 py-1 text-xs cursor-pointer hover:shadow-md"
                          title={event.title}
                        >
                          <div className="font-medium truncate">{event.title}</div>
                          {isMultiDay && (
                            <div className="text-muted-foreground text-[10px]">
                              {daysDiff} Tage
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Time slots */}
                <div className="relative">
                  {hours.map((hour) => (
                    <div
                      key={hour}
                      className="h-16 border-b cursor-pointer hover:bg-muted/30"
                    />
                  ))}

                  {/* Timed Events */}
                  {dayTimedEvents.map((event) => {
                    const start = new Date(event.start)
                    const end = new Date(event.end)
                    const startHour = start.getHours() + start.getMinutes() / 60
                    const endHour = end.getHours() + end.getMinutes() / 60
                    const duration = endHour - startHour
                    const top = (startHour / 24) * 100

                    return (
                      <div
                        key={event.id}
                        className="absolute left-1 right-1 rounded bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 p-1 text-xs cursor-pointer hover:shadow-md z-10"
                        style={{
                          top: `${top}%`,
                          height: `${(duration / 24) * 100}%`,
                        }}
                        title={`${event.title} - ${formatDateRange(start, end)}`}
                      >
                        <div className="font-medium truncate">{event.title}</div>
                        <div className="text-muted-foreground truncate">
                          {format(start, "HH:mm")}
                        </div>
                      </div>
                    )
                  })}
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

