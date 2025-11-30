'use client'

import React from 'react'
import { X, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ViewMode, SidePreviewIcon, CenteredPreviewIcon, FullscreenIcon } from './view-mode-selector'
import { cn } from '@/lib/utils'

interface PreviewSettingsPanelProps {
  defaultView: ViewMode
  onDefaultViewChange: (view: ViewMode) => void
  onClose: () => void
}

export function PreviewSettingsPanel({
  defaultView,
  onDefaultViewChange,
  onClose,
}: PreviewSettingsPanelProps) {
  const viewOptions: { mode: ViewMode; label: string; icon: React.ReactNode }[] = [
    {
      mode: 'side',
      label: 'Seitliche Vorschau',
      icon: <SidePreviewIcon className="w-5 h-5" />,
    },
    {
      mode: 'centered',
      label: 'Zentrierte Vorschau',
      icon: <CenteredPreviewIcon className="w-5 h-5" />,
    },
    {
      mode: 'fullscreen',
      label: 'Ganze Seite',
      icon: <FullscreenIcon className="w-5 h-5" />,
    },
  ]

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="sr-only">Back</span>
          </Button>
          <h2 className="text-lg font-semibold">Layout</h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8"
        >
          <X className="w-4 h-4" />
          <span className="sr-only">Close</span>
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Preview Mode Selection */}
        <div className="mb-8">
          <h3 className="text-sm font-medium mb-4">Seiten öffnen als</h3>
          <div className="grid grid-cols-3 gap-3">
            {viewOptions.map((option) => (
              <button
                key={option.mode}
                onClick={() => onDefaultViewChange(option.mode)}
                className={cn(
                  'flex flex-col items-center justify-center gap-2 p-4 border rounded-lg transition-all hover:bg-accent',
                  defaultView === option.mode && 'border-primary bg-accent'
                )}
              >
                <div className={cn(
                  'p-3 rounded',
                  defaultView === option.mode ? 'bg-primary/10' : 'bg-muted'
                )}>
                  {option.icon}
                </div>
                <span className="text-xs text-center">{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Additional Settings Placeholder */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm">Weitere Einstellungen</span>
            <span className="text-xs text-muted-foreground">Wird in nächsten Schritten hinzugefügt</span>
          </div>
        </div>
      </div>
    </div>
  )
}

