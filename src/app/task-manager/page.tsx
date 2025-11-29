"use client"

import ThemeToggle from '@/components/theme-toggle'
import dynamic from 'next/dynamic'
import React, { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { AppNav } from '@/components/app-nav'

const UserButton = dynamic(
  () => import('@clerk/nextjs').then((mod) => ({ default: mod.UserButton })),
  {
    ssr: false,
    loading: () => <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
  }
)

const TaskManagerView = dynamic(() => import('./components/task-manager'), {
  ssr: false,
})

function TaskManagerDashboardContent() {
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
        <TaskManagerView 
          defaultLayout={[20, 80]}
          defaultCollapsed={false}
          navCollapsedSize={4}
        />
      </div>
    </div>
  )
}

const TaskManagerDashboard = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <TaskManagerDashboardContent />
    </Suspense>
  )
}

export default TaskManagerDashboard

