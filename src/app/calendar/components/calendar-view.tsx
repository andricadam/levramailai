"use client"

import React from 'react'
import { Calendar } from '@/components/ui/calendar'
import { useLocalStorage } from 'usehooks-ts'
import { format } from 'date-fns'

export function CalendarView() {
  const [view] = useLocalStorage("calendar-view", "month")
  const [date, setDate] = React.useState<Date>(new Date())
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const currentView = mounted ? view : "month"

  const getHeaderText = () => {
    if (currentView === "month") {
      return format(date, "MMMM yyyy")
    } else if (currentView === "week") {
      const startOfWeek = new Date(date)
      const day = startOfWeek.getDay()
      const diff = startOfWeek.getDate() - day
      startOfWeek.setDate(diff)
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(endOfWeek.getDate() + 6)
      return `${format(startOfWeek, "MMM d")} - ${format(endOfWeek, "MMM d, yyyy")}`
    } else {
      return format(date, "EEEE, MMMM d, yyyy")
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <h1 className="text-2xl font-bold">
          {getHeaderText()}
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const newDate = new Date(date)
              if (currentView === "month") {
                newDate.setMonth(newDate.getMonth() - 1)
              } else if (currentView === "week") {
                newDate.setDate(newDate.getDate() - 7)
              } else {
                newDate.setDate(newDate.getDate() - 1)
              }
              setDate(newDate)
            }}
            className="px-3 py-1 rounded-md hover:bg-accent text-sm font-medium"
          >
            Previous
          </button>
          <button
            onClick={() => setDate(new Date())}
            className="px-3 py-1 rounded-md hover:bg-accent text-sm font-medium"
          >
            Today
          </button>
          <button
            onClick={() => {
              const newDate = new Date(date)
              if (currentView === "month") {
                newDate.setMonth(newDate.getMonth() + 1)
              } else if (currentView === "week") {
                newDate.setDate(newDate.getDate() + 7)
              } else {
                newDate.setDate(newDate.getDate() + 1)
              }
              setDate(newDate)
            }}
            className="px-3 py-1 rounded-md hover:bg-accent text-sm font-medium"
          >
            Next
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6 flex items-start justify-center">
        {currentView === "month" && (
          <Calendar
            mode="single"
            selected={date}
            onSelect={(selectedDate) => selectedDate && setDate(selectedDate)}
            className="rounded-md border"
          />
        )}
        {currentView === "week" && (
          <div className="text-center text-muted-foreground py-12">
            <p className="text-lg">Week view</p>
            <p className="text-sm mt-2">Coming soon</p>
          </div>
        )}
        {currentView === "day" && (
          <div className="text-center text-muted-foreground py-12">
            <p className="text-lg">Day view</p>
            <p className="text-sm mt-2">Coming soon</p>
          </div>
        )}
      </div>
    </div>
  )
}

