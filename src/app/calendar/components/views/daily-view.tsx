"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight, PlusIcon } from "lucide-react"
import { format, addDays, subDays, isSameDay, isToday, startOfDay, endOfDay } from "date-fns"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { api } from "@/trpc/react"
import { cn } from "@/lib/utils"
import { formatDateRange } from "little-date"
import { NoCalendarMessage } from "./no-calendar-message"
import { useLocalStorage } from "usehooks-ts"

export function DailyView() {
  const [currentDate, setCurrentDate] = React.useState(new Date())

  // Fetch events for the current day
  const startOfDayISO = startOfDay(currentDate).toISOString()
  const endOfDayISO = endOfDay(currentDate).toISOString()

  // Get the currently selected account ID
  const [accountId] = useLocalStorage('accountId', '')

  const { data: events = [], isLoading } = api.calendar.getEvents.useQuery({
    startDate: startOfDayISO,
    endDate: endOfDayISO,
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
  const sortedEvents = React.useMemo(() => {
    return [...events].sort((a, b) => {
      return new Date(a.start).getTime() - new Date(b.start).getTime()
    })
  }, [events])

  const navigateDay = (direction: 'prev' | 'next') => {
    setCurrentDate((prev) => 
      direction === 'next' ? addDays(prev, 1) : subDays(prev, 1)
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
            {format(currentDate, "EEEE, MMMM d, yyyy")}
          </h2>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigateDay('prev')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigateDay('next')}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm">
            <PlusIcon className="h-4 w-4 mr-2" />
            Create
          </Button>
        </div>
      </div>

      {/* Day View */}
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-[80px_1fr_400px] h-full">
          {/* Time column */}
          <div className="border-r bg-muted/30">
            {hours.map((hour) => (
              <div
                key={hour}
                className="h-16 border-b text-xs text-muted-foreground px-2 pt-1"
              >
                {format(new Date().setHours(hour, 0, 0, 0), "HH:mm")}
              </div>
            ))}
          </div>

          {/* Time slots with events */}
          <div className="relative border-r">
            {hours.map((hour) => (
              <div
                key={hour}
                className="h-16 border-b cursor-pointer hover:bg-muted/30"
              />
            ))}

            {/* Events */}
            {sortedEvents.map((event) => {
              const start = new Date(event.start)
              const end = new Date(event.end)
              const startHour = start.getHours() + start.getMinutes() / 60
              const endHour = end.getHours() + end.getMinutes() / 60
              const duration = Math.max(endHour - startHour, 0.5) // Minimum 30 minutes
              const top = (startHour / 24) * 100

              return (
                <div
                  key={event.id}
                  className="absolute left-1 right-1 rounded bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 p-2 cursor-pointer hover:shadow-md z-10"
                  style={{
                    top: `${top}%`,
                    height: `${(duration / 24) * 100}%`,
                  }}
                >
                  <div className="font-medium">{event.title}</div>
                  <div className="text-sm text-muted-foreground">
                    {format(start, "HH:mm")} - {format(end, "HH:mm")}
                  </div>
                  {event.location && (
                    <div className="text-xs text-muted-foreground mt-1">
                      📍 {event.location}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Events list */}
          <div className="p-4 overflow-y-auto">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Events</h3>
                </div>
                <div className="space-y-2">
                  {isLoading ? (
                    <div className="text-sm text-muted-foreground text-center py-4">
                      Loading...
                    </div>
                  ) : sortedEvents.length > 0 ? (
                    sortedEvents.map((event) => (
                      <div
                        key={event.id}
                        className="p-2 rounded border cursor-pointer hover:bg-muted"
                      >
                        <div className="font-medium text-sm">{event.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDateRange(new Date(event.start), new Date(event.end))}
                        </div>
                        {event.location && (
                          <div className="text-xs text-muted-foreground mt-1">
                            📍 {event.location}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground text-center py-4">
                      No events scheduled
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

