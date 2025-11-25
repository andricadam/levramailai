"use client"

import ThemeToggle from '@/components/theme-toggle'
import dynamic from 'next/dynamic'
import React, { Suspense } from 'react'
import { UserButton } from '@clerk/nextjs'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { AppNav } from '@/components/app-nav'
import AskAIButton from './components/ai/ask-ai/ask-ai-button'
const ComposeButton = dynamic(() => {
  return import('./components/compose-button')
}, {
  ssr: false,
  loading: () => <div className="w-10 h-10" />
})
// import Mail from './mail'

const Mail = dynamic(() => import('./components/mail'), {
  ssr: false,
  loading: () => <div>Loading mail...</div>,
})

function MailDashboardContent() {
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
            <ComposeButton />
          </div>
        </div>
        <Mail 
          defaultLayout={[20, 32, 48]}
          defaultCollapsed={false}
          navCollapsedSize={4}
        />
        <AskAIButton />
      </div>
    </div>
  )
}

const MailDashboard = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <MailDashboardContent />
    </Suspense>
  )
}

export default MailDashboard