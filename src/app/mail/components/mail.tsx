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
import useThreads from '@/hooks/use-threads'
import { useLocalStorage } from 'usehooks-ts'
import { ViewMode } from './view-mode-selector'
import { PreviewSettingsPanel } from './preview-settings-panel'

type Props = {
    defaultLayout: number[] | undefined
    navCollapsedSize: number
    defaultCollapsed: boolean | undefined
}

const Mail = ({ defaultLayout = [20,32,48], navCollapsedSize, defaultCollapsed }: Props) => {

    const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed ?? false)
    const tabsId = React.useId()
    const { threadId, setThreadId } = useThreads()
    const [defaultViewMode, setDefaultViewMode] = useLocalStorage<ViewMode>('mail-default-view-mode', 'centered')
    const [currentViewMode, setCurrentViewMode] = React.useState<ViewMode>(defaultViewMode)
    const [showSettings, setShowSettings] = React.useState(false)

    // Reset view mode when thread changes
    React.useEffect(() => {
        if (threadId) {
            setCurrentViewMode(defaultViewMode)
        }
    }, [threadId, defaultViewMode])

    return (
        <TooltipProvider delayDuration={0}>
        <div className='flex h-screen items-stretch overflow-hidden relative'>
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

            {/* Thread List Panel - Always visible, blurred when thread is selected (except in side view and fullscreen) */}
            {(currentViewMode !== 'fullscreen' || !threadId) && (
                <div 
                    className={cn(
                        'flex flex-col h-full flex-shrink-0 transition-all duration-200',
                        threadId && currentViewMode !== 'side' && 'blur-[0.5px] pointer-events-none',
                        threadId && currentViewMode === 'side' ? 'w-[40%]' : 'flex-1'
                    )}
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
            )}
            {/* Side View - Thread Display on the right */}
            {threadId && currentViewMode === 'side' && (
                <>
                    {/* Fixed Separator */}
                    <div className='w-px bg-border flex-shrink-0' />
                    {/* Thread Display Panel */}
                    <div className='flex flex-col h-full flex-1 flex-shrink-0 min-w-0'>
                        <ThreadDisplay 
                            currentViewMode={currentViewMode}
                            onViewModeChange={setCurrentViewMode}
                            onFullscreen={() => setCurrentViewMode('fullscreen')}
                            onSettingsClick={() => setShowSettings(true)}
                        />
                    </div>
                </>
            )}

            {/* Centered Modal Overlay - Thread Display */}
            {threadId && currentViewMode === 'centered' && (
                <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
                    {/* Backdrop */}
                    <div 
                        className='absolute inset-0 bg-background/80 backdrop-blur-[0.5px]'
                        onClick={() => setThreadId(null)}
                    />
                    
                    {/* Modal Content - Wider */}
                    <div className='relative z-10 w-full max-w-6xl h-[90vh] bg-background border rounded-lg shadow-lg flex flex-col overflow-hidden'>
                        <ThreadDisplay 
                            currentViewMode={currentViewMode}
                            onViewModeChange={setCurrentViewMode}
                            onFullscreen={() => setCurrentViewMode('fullscreen')}
                            onSettingsClick={() => setShowSettings(true)}
                        />
                    </div>
                </div>
            )}

            {/* Fullscreen View - Thread Display (Sidebar remains visible) */}
            {threadId && currentViewMode === 'fullscreen' && (
                <>
                    {/* Fixed Separator */}
                    <div className='w-px bg-border flex-shrink-0' />
                    {/* Thread Display Panel - Takes remaining space */}
                    <div className='flex flex-col h-full flex-1 flex-shrink-0 min-w-0'>
                        <ThreadDisplay 
                            currentViewMode={currentViewMode}
                            onViewModeChange={setCurrentViewMode}
                            onFullscreen={() => setCurrentViewMode('fullscreen')}
                            onSettingsClick={() => setShowSettings(true)}
                        />
                    </div>
                </>
            )}

            {/* Settings Panel Overlay */}
            {showSettings && (
                <div className='fixed inset-0 z-[60] flex items-center justify-center p-4'>
                    {/* Backdrop */}
                    <div 
                        className='absolute inset-0 bg-background/80 backdrop-blur-[0.5px]'
                        onClick={() => setShowSettings(false)}
                    />
                    
                    {/* Settings Panel */}
                    <div className='relative z-10 w-full max-w-2xl h-[80vh] bg-background border rounded-lg shadow-lg flex flex-col overflow-hidden'>
                        <PreviewSettingsPanel
                            defaultView={defaultViewMode}
                            onDefaultViewChange={(view) => {
                                setDefaultViewMode(view)
                                setCurrentViewMode(view)
                            }}
                            onClose={() => setShowSettings(false)}
                        />
                    </div>
                </div>
            )}
        </div>
    </TooltipProvider>
    )
}

export default Mail