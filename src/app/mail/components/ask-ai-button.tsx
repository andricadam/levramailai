'use client'

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import FruitIcon from './fruit-icon'
import AskAI from './ask-ai'

const AskAIButton = () => {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-[#4A4A4A] shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center hover:scale-105 active:scale-95 hover:bg-[#5A5A5A]"
          aria-label="Ask AI about your emails"
        >
          <FruitIcon className="w-10 h-10" />
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

