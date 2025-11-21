"use client"

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Mail, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

export function AppNav() {
  const pathname = usePathname()
  
  const navItems = [
    {
      title: 'Mail',
      href: '/mail',
      icon: Mail,
      badge: null, // You can add badge count here if needed
    },
    {
      title: 'Calendar',
      href: '/calendar',
      icon: Clock,
      badge: null,
    },
  ]

  return (
    <div className="flex flex-col h-full w-16 items-center py-2 border-r bg-sidebar">
      {/* Hamburger menu placeholder - can be expanded later */}
      <div className="w-full flex items-center justify-center py-2 mb-2">
        <div className="h-6 w-6 flex flex-col gap-1 cursor-pointer">
          <div className="h-0.5 w-full bg-muted-foreground rounded"></div>
          <div className="h-0.5 w-full bg-muted-foreground rounded"></div>
          <div className="h-0.5 w-full bg-muted-foreground rounded"></div>
        </div>
      </div>
      
      <nav className="flex flex-col gap-1 w-full px-2">
        {navItems.map((item) => {
          const isActive = pathname?.startsWith(item.href)
          const Icon = item.icon
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 py-2 rounded-lg transition-colors group",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <div className={cn(
                "relative flex items-center justify-center",
                isActive && "bg-primary/20 rounded-lg p-2"
              )}>
                <Icon className={cn(
                  "h-5 w-5",
                  isActive && "text-primary"
                )} />
                {item.badge && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                  >
                    {item.badge}
                  </Badge>
                )}
              </div>
              <span className={cn(
                "text-xs font-medium",
                isActive ? "text-primary" : "text-muted-foreground"
              )}>
                {item.title}
              </span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

