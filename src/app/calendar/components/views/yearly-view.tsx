"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight, PlusIcon } from "lucide-react"
import { format, startOfYear, endOfYear, startOfMonth, eachMonthOfInterval, isSameMonth, isToday } from "date-fns"
import { Button } from "@/components/ui/button"
import { api } from "@/trpc/react"
import { cn } from "@/lib/utils"
import { NoCalendarMessage } from "./no-calendar-message"
import { useLocalStorage } from "usehooks-ts"
import { CreateEventDialog } from "../create-event-dialog"

export function YearlyView() {
  const [currentYear, setCurrentYear] = React.useState(new Date().getFullYear())
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false)
  const yearStart = startOfYear(new Date(currentYear, 0, 1))
  const yearEnd = endOfYear(new Date(currentYear, 0, 1))
  const months = eachMonthOfInterval({ start: yearStart, end: yearEnd })

  // Fetch all events for the year
  const startOfYearISO = yearStart.toISOString()
  const endOfYearISO = yearEnd.toISOString()

  // Get the currently selected account ID
  const [accountId] = useLocalStorage('accountId', '')

  const { data: events = [] } = api.calendar.getEvents.useQuery({
    startDate: startOfYearISO,
    endDate: endOfYearISO,
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
  // Group events by month
  const eventsByMonth = React.useMemo(() => {
    const grouped: Record<number, number> = {}
    events.forEach((event) => {
      const month = new Date(event.start).getMonth()
      grouped[month] = (grouped[month] || 0) + 1
    })
    return grouped
  }, [events])

  const navigateYear = (direction: 'prev' | 'next') => {
    setCurrentYear((prev) => prev + (direction === 'next' ? 1 : -1))
  }

  const goToToday = () => {
    setCurrentYear(new Date().getFullYear())
  }

  const weekDays = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]

  if (!hasCalendarConnection) {
    return <NoCalendarMessage />
  }

  // Get days in month for a given month
  const getDaysInMonth = (date: Date) => {
    const firstDay = startOfMonth(date)
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1 // Monday = 0
    
    const days: (number | null)[] = []
    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day)
    }
    return days
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold">{currentYear}</h2>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigateYear('prev')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigateYear('next')}
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

      {/* Year Grid */}
      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-4 gap-4">
          {months.map((month, idx) => {
            const days = getDaysInMonth(month)
            const eventCount = eventsByMonth[idx] || 0
            const currentMonth = new Date()
            const isCurrentMonth = isSameMonth(month, currentMonth)

            return (
              <div
                key={idx}
                className="border rounded-lg p-2 bg-background hover:shadow-md transition-shadow"
              >
                <div className="text-sm font-semibold mb-1.5 flex items-center justify-between">
                  <span>{format(month, "MMMM")}</span>
                  {eventCount > 0 && (
                    <span className="text-xs text-muted-foreground font-normal">
                      {eventCount}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-7 gap-px text-xs">
                  {/* Weekday headers */}
                  {weekDays.map((day) => (
                    <div
                      key={day}
                      className="text-center text-muted-foreground font-medium py-1 text-[10px]"
                    >
                      {day.charAt(0)}
                    </div>
                  ))}
                  {/* Days */}
                  {days.map((day, dayIdx) => {
                    if (day === null) {
                      return <div key={dayIdx} className="p-0.5" />
                    }
                    const dayDate = new Date(month.getFullYear(), month.getMonth(), day)
                    const isTodayDate = isToday(dayDate)
                    const isCurrentYearMonth = month.getFullYear() === currentYear && isCurrentMonth

                    return (
                      <div
                        key={dayIdx}
                        className={cn(
                          "text-center p-0.5 rounded min-h-[20px] flex items-center justify-center",
                          isTodayDate && "bg-primary text-primary-foreground font-semibold",
                          !isCurrentYearMonth && "text-muted-foreground/50"
                        )}
                      >
                        {day}
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

