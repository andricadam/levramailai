'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import AskAI from './ask-ai'

const AskAIButton = () => {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Prevent hydration mismatch by only rendering on client
  if (!mounted) {
    return null
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center"
          aria-label="Ask AI about your emails"
        >
          <Image 
            src="/ask-ai.png" 
            alt="Ask AI" 
            width={40}
            height={40}
            className="object-contain"
          />
        </button>
      </SheetTrigger>
      <SheetContent 
        side="right"
        className="w-full sm:max-w-md p-0 overflow-hidden flex flex-col"
      >
        <SheetTitle className="sr-only">New AI Chat</SheetTitle>
        <AskAI onClose={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  )
}

export default AskAIButton

