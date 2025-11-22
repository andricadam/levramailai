"use client"

import React from 'react'
import { Separator } from '@/components/ui/separator'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { AccountSwitcher } from './account-switcher'
import { Sidebar } from './sidebar'
import ThreadList from './thread-list'
import { ThreadDisplay } from './thread-display'
import SearchBar from './search-bar'
import PremiumBanner from './premium-banner'

type Props = {
    defaultLayout: number[] | undefined
    navCollapsedSize: number
    defaultCollapsed: boolean | undefined
}

const Mail = ({ defaultLayout = [20,32,48], navCollapsedSize, defaultCollapsed }: Props) => {

    const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed ?? false)
    const tabsId = React.useId()

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
                
                {/* Premium Banner Section */}
                <div className="border-t flex-shrink-0 overflow-hidden p-3 pb-24">
                    <PremiumBanner />
                </div>
            </div>

            {/* Fixed Separator */}
            <div className='w-px bg-border flex-shrink-0' />

            {/* Thread List Panel - Fixed Width */}
            <div 
                className='flex flex-col h-full flex-shrink-0'
                style={{ width: `${defaultLayout[1]}%` }}
            >
                <Tabs id={tabsId} defaultValue="inbox" className='flex flex-col h-full'>
                    <div className='flex items-center px-4 py-2'>
                        <h1 className='text-xl font-bold'>Inbox</h1>
                        <TabsList className='ml-auto'>
                            <TabsTrigger value="inbox" className='text-xinc-600 dark:text-zinc-200'>
                                Inbox
                            </TabsTrigger>
                            <TabsTrigger value="done" className='text-xinc-600 dark:text-zinc-200'>
                                Done
                            </TabsTrigger>
                        </TabsList>
                    </div>
                    <Separator />
                    <SearchBar />
                    <TabsContent value="inbox" className='flex-1 overflow-y-auto min-h-0'>
                        <ThreadList />
                    </TabsContent>
                    <TabsContent value="done" className='flex-1 overflow-y-auto min-h-0'>
                        <ThreadList />
                    </TabsContent>
                </Tabs>
            </div>

            {/* Fixed Separator */}
            <div className='w-px bg-border flex-shrink-0' />

            {/* Thread Display Panel - Fixed Width */}
            <div 
                className='flex flex-col h-full flex-shrink-0'
                style={{ width: `${defaultLayout[2]}%` }}
            >
                <ThreadDisplay />
            </div>
        </div>
    </TooltipProvider>
    )
}

export default Mail