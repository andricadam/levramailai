'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import AskAI from './ask-ai'

const AskAIButton = () => {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
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
      </DialogTrigger>
      <DialogContent 
        className="max-w-md max-h-[80vh] p-0 overflow-hidden bg-muted/50"
        showCloseButton={true}
      >
        <AskAI />
      </DialogContent>
    </Dialog>
  )
}

export default AskAIButton

