"use client"

import React from 'react'
import { Separator } from '@/components/ui/separator'
import { TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { AccountSwitcher } from '@/app/mail/components/account-switcher'
import { Sidebar } from './sidebar'
import { SettingsContent } from './settings-content'

type Props = {
    defaultLayout: number[] | undefined
    navCollapsedSize: number
    defaultCollapsed: boolean | undefined
}

const Settings = ({ defaultLayout = [20, 80], navCollapsedSize, defaultCollapsed }: Props) => {

    const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed ?? false)

    return (
        <TooltipProvider delayDuration={0}>
        <div className='flex h-screen items-stretch overflow-hidden'>
            {/* Sidebar Panel - Fixed Width */}
            <div 
                className={cn(
                    'flex flex-col h-full flex-shrink-0 transition-all duration-300 ease-in-out border-r bg-sidebar overflow-hidden'
                )}
                style={{ width: isCollapsed ? '48px' : `${defaultLayout[0]}%` }}
            >
                {/* Account Switcher Section */}
                <div className={cn('flex h-[52px] items-center justify-between border-b flex-shrink-0', isCollapsed ? 'h-[52px] px-2' : 'px-3')}>
                    <AccountSwitcher isCollapsed={isCollapsed} />
                </div>
                
                {/* Navigation Section */}
                <div className="flex-1 overflow-y-auto min-h-0">
                    <Sidebar isCollapsed={isCollapsed} />
                </div>
            </div>

            {/* Fixed Separator */}
            <div className='w-px bg-border flex-shrink-0' />

            {/* Settings Content Panel */}
            <div 
                className='flex flex-col h-full flex-shrink-0'
                style={{ width: `${defaultLayout[1]}%` }}
            >
                <SettingsContent />
            </div>
        </div>
    </TooltipProvider>
    )
}

export default Settings

