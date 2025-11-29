"use client"

import * as React from "react"
import { useLocalStorage } from "usehooks-ts"
import { DailyView } from "./views/daily-view"
import { WeeklyView } from "./views/weekly-view"
import { MonthlyView } from "./views/monthly-view"
import { YearlyView } from "./views/yearly-view"

export function CalendarView() {
  const [mounted, setMounted] = React.useState(false)
  const [view] = useLocalStorage("calendar-view", "month")

  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Use default "month" on server to match initial client render
  const currentView = mounted ? view : "month"

  // Render the appropriate view
  switch (currentView) {
    case "day":
      return <DailyView />
    case "week":
      return <WeeklyView />
    case "month":
      return <MonthlyView />
    case "year":
      return <YearlyView />
    default:
      return <MonthlyView />
  }
}
