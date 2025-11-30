"use client"

import * as React from "react"
import { api } from "@/trpc/react"
import { useLocalStorage } from "usehooks-ts"

export function NoCalendarMessage() {
  const { data: connections = [] } = api.integrations.getConnections.useQuery()
  const [accountId] = useLocalStorage('accountId', '')

  // Check for calendar connection for the current account
  const hasCalendarConnection = connections.some(
    (conn) => 
      (conn.appType === 'google_calendar' || conn.appType === 'microsoft_calendar') && 
      conn.enabled &&
      (!accountId || conn.accountId === accountId)
  )

  if (hasCalendarConnection) {
    return null
  }

  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center space-y-2 max-w-md">
        <p className="text-lg font-medium">No calendar connected</p>
        <p className="text-sm text-muted-foreground">
          Connect your Google or Microsoft email account to automatically sync calendar events.
        </p>
      </div>
    </div>
  )
}

