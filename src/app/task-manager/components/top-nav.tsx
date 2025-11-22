"use client"

import * as React from "react"
import { CheckSquare, LayoutGrid } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLocalStorage } from "usehooks-ts"

interface NavItem {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const navItems: NavItem[] = [
  { id: "checkbox", label: "Checkbox View", icon: CheckSquare },
  { id: "kanban", label: "Kanban View", icon: LayoutGrid },
]

export function TopNav() {
  const [activeView, setActiveView] = useLocalStorage("task-manager-view", "checkbox")

  return (
    <div className="flex items-center gap-1 border-b bg-background px-4 py-2">
      {navItems.map((item) => {
        const Icon = item.icon
        const isActive = activeView === item.id
        
        return (
          <button
            key={item.id}
            onClick={() => setActiveView(item.id)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{item.label}</span>
          </button>
        )
      })}
    </div>
  )
}

