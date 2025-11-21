"use client"

import ThemeToggle from '@/components/theme-toggle'
import dynamic from 'next/dynamic'
import React, { Suspense } from 'react'
import { UserButton } from '@clerk/nextjs'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { AppNav } from '@/components/app-nav'

const CalendarView = dynamic(() => import('./components/calendar'), {
  ssr: false,
})

function CalendarDashboardContent() {
  const searchParams = useSearchParams()
  
  React.useEffect(() => {
    const error = searchParams.get('error')
    if (error) {
      toast.error(error)
      // Clean up the URL by removing the error parameter
      const url = new URL(window.location.href)
      url.searchParams.delete('error')
      window.history.replaceState({}, '', url.toString())
    }
  }, [searchParams])

  return (
    <div className="h-screen w-screen overflow-hidden relative flex">
      {/* Permanent Navigation Bar */}
      <AppNav />
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        <div className="absolute bottom-4 left-20 z-10">
          <div className="flex items-center gap-2">
            <UserButton />
            <ThemeToggle />
          </div>
        </div>
        <CalendarView 
          defaultLayout={[20, 80]}
          defaultCollapsed={false}
          navCollapsedSize={4}
        />
      </div>
    </div>
  )
}

const CalendarDashboard = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CalendarDashboardContent />
    </Suspense>
  )
}

export default CalendarDashboard

