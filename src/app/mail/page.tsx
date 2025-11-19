"use client"

import ThemeToggle from '@/components/theme-toggle'
import dynamic from 'next/dynamic'
import React, { Suspense } from 'react'
import { UserButton } from '@clerk/nextjs'
import ComposeButton from './components/compose-button'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
// import Mail from './mail'

const Mail = dynamic(() => import('./components/mail'), {
  ssr: false,
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
    <>
      <div className="absolute bottom-4 left-4">
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
    </>
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