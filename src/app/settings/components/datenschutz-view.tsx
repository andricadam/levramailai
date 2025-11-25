"use client"

import React from 'react'
import { Shield, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export function DatenschutzView() {
  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
          <Shield className="h-6 w-6 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-1">Privacy</h2>
          <p className="text-sm text-muted-foreground">
            Levra stands for transparent data practices
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="space-y-6">
        {/* Descriptive Paragraph */}
        <p className="text-sm text-muted-foreground leading-relaxed">
          Learn how your information is protected when using Levra products, and visit our{' '}
          <button
            onClick={() => {
              // TODO: Navigate to privacy center
              console.log('Navigate to Privacy Center')
            }}
            className="underline hover:text-foreground transition-colors cursor-pointer"
          >
            Privacy Center
          </button>
          {' '}and our{' '}
          <button
            onClick={() => {
              // TODO: Navigate to privacy policy
              console.log('Navigate to Privacy Policy')
            }}
            className="underline hover:text-foreground transition-colors cursor-pointer"
          >
            Privacy Policy
          </button>
          {' '}for more details.
        </p>

        {/* Interactive Sections */}
        <div className="space-y-2">
          <button
            onClick={() => {
              // TODO: Expand or navigate to "How we protect your data"
              console.log('Navigate to: How we protect your data')
            }}
            className={cn(
              "w-full flex items-center justify-between p-4 rounded-lg",
              "hover:bg-accent transition-colors",
              "text-left"
            )}
          >
            <span className="text-sm">How we protect your data</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>

          <button
            onClick={() => {
              // TODO: Expand or navigate to "How we use your data"
              console.log('Navigate to: How we use your data')
            }}
            className={cn(
              "w-full flex items-center justify-between p-4 rounded-lg",
              "hover:bg-accent transition-colors",
              "text-left"
            )}
          >
            <span className="text-sm">How we use your data</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  )
}

