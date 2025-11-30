'use client'

import React from 'react'
import { Maximize2, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export type ViewMode = 'side' | 'centered' | 'fullscreen'

// Custom icons matching the reference design
export const SidePreviewIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Outer rectangle */}
    <rect x="2" y="4" width="20" height="16" rx="1" />
    {/* Inner rectangle on the left */}
    <rect x="4" y="6" width="6" height="12" rx="0.5" />
  </svg>
)

export const CenteredPreviewIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Outer rectangle */}
    <rect x="2" y="4" width="20" height="16" rx="1" />
    {/* Inner rectangle centered */}
    <rect x="7" y="7" width="10" height="10" rx="0.5" />
  </svg>
)

export const FullscreenIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Outer rectangle */}
    <rect x="2" y="4" width="20" height="16" rx="1" />
    {/* Inner rectangle filling the space */}
    <rect x="4" y="6" width="16" height="12" rx="0.5" />
  </svg>
)

interface ViewModeSelectorProps {
  currentView: ViewMode
  onViewChange: (view: ViewMode) => void
  onFullscreen: () => void
  onSettingsClick: () => void
}

export function ViewModeSelector({ 
  currentView, 
  onViewChange, 
  onFullscreen,
  onSettingsClick 
}: ViewModeSelectorProps) {
  const getViewIcon = (view: ViewMode) => {
    switch (view) {
      case 'side':
        return <SidePreviewIcon className="w-4 h-4" />
      case 'centered':
        return <CenteredPreviewIcon className="w-4 h-4" />
      case 'fullscreen':
        return <FullscreenIcon className="w-4 h-4" />
    }
  }

  const getViewLabel = (view: ViewMode) => {
    switch (view) {
      case 'side':
        return 'Seitliche Vorschau'
      case 'centered':
        return 'Zentrierte Vorschau'
      case 'fullscreen':
        return 'Ganze Seite'
    }
  }

  return (
    <div className="flex items-center gap-1">
      {/* Fullscreen Button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={onFullscreen}
            className="h-8 w-8"
          >
            <Maximize2 className="w-4 h-4" />
            <span className="sr-only">Fullscreen</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Fullscreen</TooltipContent>
      </Tooltip>

      {/* View Mode Selector */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
          >
            {getViewIcon(currentView)}
            <span className="sr-only">View mode</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem
            onClick={() => onViewChange('side')}
            className={cn(currentView === 'side' && 'bg-accent')}
          >
            <SidePreviewIcon className="w-4 h-4 mr-2" />
            {getViewLabel('side')}
            {currentView === 'side' && <span className="ml-auto">✓</span>}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onViewChange('centered')}
            className={cn(currentView === 'centered' && 'bg-accent')}
          >
            <CenteredPreviewIcon className="w-4 h-4 mr-2" />
            {getViewLabel('centered')}
            {currentView === 'centered' && <span className="ml-auto">✓</span>}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onViewChange('fullscreen')}
            className={cn(currentView === 'fullscreen' && 'bg-accent')}
          >
            <FullscreenIcon className="w-4 h-4 mr-2" />
            {getViewLabel('fullscreen')}
            {currentView === 'fullscreen' && <span className="ml-auto">✓</span>}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onSettingsClick}>
            <Settings className="w-4 h-4 mr-2" />
            Standardansicht bearbeiten...
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

