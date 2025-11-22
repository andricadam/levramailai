"use client"

import * as React from "react"

import { formatDateRange } from "little-date"
import { PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardFooter } from "@/components/ui/card"

const events = [
  {
    title: "Team Sync Meeting",
    from: "2025-06-12T09:00:00",
    to: "2025-06-12T10:00:00",
  },
  {
    title: "Design Review",
    from: "2025-06-12T11:30:00",
    to: "2025-06-12T12:30:00",
  },
  {
    title: "Client Presentation",
    from: "2025-06-12T14:00:00",
    to: "2025-06-12T15:00:00",
  },
]

export function CalendarView() {
  const [date, setDate] = React.useState<Date | undefined>(
    new Date(2025, 5, 12)
  )

  // Filter events for the selected date
  const selectedDateEvents = React.useMemo(() => {
    if (!date) return []
    
    const dateStr = date.toISOString().split('T')[0]
    return events.filter(event => {
      const eventDate = event.from.split('T')[0]
      return eventDate === dateStr
    })
  }, [date])

  return (
    <div className="flex h-full w-full gap-6 p-6">
      {/* Monthly Calendar View - Left Side */}
      <div className="flex items-center justify-center">
        <div className="w-fit min-h-[400px] flex items-center">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            fixedWeeks={true}
            className="rounded-lg border [--cell-size:--spacing(11)] md:[--cell-size:--spacing(20)]"
            buttonVariant="ghost"
          />
        </div>
      </div>

      {/* Daily View - Right Side */}
      <div className="flex-1 flex items-start justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="px-4 pt-6">
            <div className="flex w-full items-center justify-between px-1 mb-4">
              <div className="text-sm font-medium">
                {date?.toLocaleDateString("en-US", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                title="Add Event"
              >
                <PlusIcon />
                <span className="sr-only">Add Event</span>
              </Button>
            </div>
            <div className="flex w-full flex-col gap-2">
              {selectedDateEvents.length > 0 ? (
                selectedDateEvents.map((event) => (
                  <div
                    key={event.title}
                    className="bg-muted after:bg-primary/70 relative rounded-md p-2 pl-6 text-sm after:absolute after:inset-y-2 after:left-2 after:w-1 after:rounded-full"
                  >
                    <div className="font-medium">{event.title}</div>
                    <div className="text-muted-foreground text-xs">
                      {formatDateRange(new Date(event.from), new Date(event.to))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-muted-foreground text-sm text-center py-4">
                  No events scheduled for this day
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

