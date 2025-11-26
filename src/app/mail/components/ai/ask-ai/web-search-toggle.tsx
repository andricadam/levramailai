'use client'
import { Globe } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

type WebSearchToggleProps = {
  enabled: boolean
  onToggle: (enabled: boolean) => void
}

export function WebSearchToggle({
  enabled,
  onToggle,
}: WebSearchToggleProps) {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/50">
      <Globe className="size-4 text-muted-foreground" />
      <Label htmlFor="web-search-toggle" className="text-xs text-muted-foreground cursor-pointer">
        Web search
      </Label>
      <Switch
        id="web-search-toggle"
        checked={enabled}
        onCheckedChange={onToggle}
      />
    </div>
  )
}

