'use client'
import React from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Text from '@tiptap/extension-text'
import TipTapMenuBar from './editor-menubar'
import { Button } from '@/components/ui/button'
import TagInput from './tag-input'
import { Input } from '@/components/ui/input'
import AIComposeButton from './ai/compose/ai-compose-button'
import { generate } from './ai/autocomplete/action'
import { readStreamableValue } from '@ai-sdk/rsc'
import { X, Minus, Sparkles, Mic, Bot, Paperclip, Trash2, ChevronDown, Calendar } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format, addDays, setHours, setMinutes, nextMonday } from 'date-fns'
import { de } from 'date-fns/locale'
import { Textarea } from "@/components/ui/textarea"
import { generateEmail } from './ai/compose/action'
import { turndown } from '@/lib/turndown'
import useThreads from '../use-Threads'
import { useThread } from '../use-thread'

type Props = {
    subject: string
    setSubject: (subject: string) => void

    toValues: { label: string, value: string }[]
    setToValues: (values: { label: string, value: string }[]) => void

    ccValues: { label: string, value: string }[]
    setCcValues: (values: { label: string, value: string }[]) => void

    to: string[]

    handleSend: (value: string) => void
    isSending: boolean

    defaultToolbarExpanded?: boolean
    account?: { name: string | null; emailAddress: string | null } | null
    onClose?: () => void
    onFeedbackIdChange?: (feedbackId: string | null) => void
}

const EmailEditor = ({ 
    subject, 
    setSubject, 
    toValues, 
    setToValues, 
    ccValues, 
    setCcValues, 
    to, 
    handleSend, 
    isSending, 
    defaultToolbarExpanded = false,
    account,
    onClose,
    onFeedbackIdChange
}: Props) => {
    const [value, setValue] = React.useState<string>('')
    const [showCcBcc, setShowCcBcc] = React.useState(false)
    const [bccValues, setBccValues] = React.useState<{ label: string; value: string }[]>([])
    const [aiComposeOpen, setAiComposeOpen] = React.useState(false)
    const [aiPrompt, setAiPrompt] = React.useState('')
    const [scheduledDate, setScheduledDate] = React.useState<Date | null>(null)
    const [customDateOpen, setCustomDateOpen] = React.useState(false)
    const [selectedDate, setSelectedDate] = React.useState<Date>()
    const [selectedTime, setSelectedTime] = React.useState<string>('12:00')
    const [timezone] = React.useState<string>('GMT+01')
    const insertedTextRef = React.useRef<string>('')
    const aiGenerateRef = React.useRef<((editorInstance: any) => Promise<void>) | null>(null)
    const { account: accountData, threads, accountId } = useThreads()
    const [threadId] = useThread()
    const thread = threads?.find(t => t.id === threadId)

    const aiGenerate = React.useCallback(async (editorInstance: any) => {
        if (!editorInstance) return
        const currentText = editorInstance.getText()
        const { output } = await generate(currentText)
        let accumulatedText = ''
        insertedTextRef.current = ''
        
        for await (const delta of readStreamableValue(output)) {
            if (delta) {
                accumulatedText += delta
                const newText = accumulatedText.slice(insertedTextRef.current.length)
                if (newText) {
                    editorInstance.commands.insertContent(newText)
                    insertedTextRef.current = accumulatedText
                }
            }
        }
    }, [])

    aiGenerateRef.current = aiGenerate

    // Helper functions for scheduling
    const getTomorrowMorning = () => {
        const tomorrow = addDays(new Date(), 1)
        return setHours(setMinutes(tomorrow, 45), 7)
    }

    const getTomorrowAfternoon = () => {
        const tomorrow = addDays(new Date(), 1)
        return setHours(setMinutes(tomorrow, 28), 13)
    }

    const getNextMondayMorning = () => {
        const monday = nextMonday(new Date())
        return setHours(setMinutes(monday, 18), 8)
    }

    const handleScheduleDate = (date: Date) => {
        setScheduledDate(date)
        setCustomDateOpen(false)
    }

    const handleCustomDateSave = () => {
        if (selectedDate && selectedTime) {
            const timeParts = selectedTime.split(':')
            const hours = timeParts[0] ? Number(timeParts[0]) : 12
            const minutes = timeParts[1] ? Number(timeParts[1]) : 0
            const scheduled = setHours(setMinutes(selectedDate, minutes), hours)
            handleScheduleDate(scheduled)
        }
    }

    const handleAiCompose = async (prompt: string) => {
        let context: string | undefined = ''
        if (!defaultToolbarExpanded) {
            for (const email of thread?.emails ?? []) {
                const content = `
Subject: ${email.subject}
From: ${email.from?.address || email.from || 'Unknown'}
Sent: ${new Date(email.sentAt).toLocaleString()}
Body: ${turndown.turndown(email.body ?? email.bodySnippet ?? "")}

`
                context += content
            }
        }
        context += `
My name is ${accountData?.name} and my email is ${accountData?.emailAddress}.
`

        const { output, feedbackId } = await generateEmail(context, prompt, {
            accountId: accountId ?? undefined,
            threadId: threadId ?? undefined,
        })

        if (feedbackId && onFeedbackIdChange) {
            onFeedbackIdChange(feedbackId)
        }

        let accumulatedText = ''
        for await (const delta of readStreamableValue(output)) {
            if (delta) {
                accumulatedText += delta
                if (editor) {
                    editor.commands.setContent(accumulatedText)
                }
            }
        }
        setAiComposeOpen(false)
        setAiPrompt('')
    }

    const CustomText = Text.extend({
        addKeyboardShortcuts() {
            return {
                'Space': ({ editor }) => {
                    const text = editor.getText()
                    // Only trigger if editor is empty
                    if (!text || text.trim() === '') {
                        setAiComposeOpen(true)
                        return true
                    }
                    return false
                },
                'Meta-j': () => {
                    if (aiGenerateRef.current) {
                        aiGenerateRef.current(this.editor).catch(console.error)
                    }
                    return true
                }
            }
        },
    })

    const [isEditorFocused, setIsEditorFocused] = React.useState(false)
    const [cursorPosition, setCursorPosition] = React.useState(0)

    const editor = useEditor({
        autofocus: false,
        immediatelyRender: false,
        extensions: [StarterKit, CustomText],
        content: '',
        editorProps: {
            attributes: {
                class: 'prose prose-sm max-w-none focus:outline-none min-h-[200px] px-4 py-3',
            },
        },
        onUpdate: ({ editor }) => {
            setValue(editor.getHTML())
            // Update cursor position
            const { from } = editor.state.selection
            setCursorPosition(from)
        },
        onSelectionUpdate: ({ editor }) => {
            // Update cursor position on selection change
            const { from } = editor.state.selection
            setCursorPosition(from)
        },
        onFocus: () => {
            setIsEditorFocused(true)
            // Update cursor position on focus - use setTimeout to ensure editor state is ready
            setTimeout(() => {
                if (editor) {
                    const { from } = editor.state.selection
                    setCursorPosition(from)
                }
            }, 0)
        },
        onBlur: () => {
            setIsEditorFocused(false)
        }
    })

    const onGenerate = React.useCallback((content: string) => {
        if (editor) {
            editor.commands.setContent(content)
        }
    }, [editor])

    // Calculate scheduled times

    // Ensure cursor position is tracked when editor is ready
    React.useEffect(() => {
        if (editor && isEditorFocused) {
            const { from } = editor.state.selection
            setCursorPosition(from)
        }
    }, [editor, isEditorFocused])

    if (!editor) return null

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Top Header with User Info and Window Controls */}
            <div className='flex items-center justify-between px-4 py-3 border-b flex-shrink-0'>
                <div className='flex items-center gap-2'>
                    <span className='font-semibold text-sm'>{account?.name || 'Me'}</span>
                    <span className='text-sm text-muted-foreground'>{account?.emailAddress || ''}</span>
                </div>
                <div className='flex items-center gap-2'>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => {
                            // Minimize functionality - for now just close
                            if (onClose) onClose()
                        }}
                    >
                        <Minus className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => {
                            if (onClose) onClose()
                        }}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* To Field with Cc/Bcc Button */}
            <div className='px-4 py-2 border-b flex-shrink-0'>
                <div className='flex items-center justify-between gap-2'>
                    <div className='flex-1'>
                    <TagInput
                            label='An'
                        onChange={setToValues}
                            placeholder='Empfänger/-in hinzufügen'
                        value={toValues}
                    />
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs whitespace-nowrap"
                        onClick={() => setShowCcBcc(!showCcBcc)}
                    >
                        Cc/Bcc
                    </Button>
                </div>
            </div>

            {/* Cc and Bcc Fields - Shown when Cc/Bcc is clicked */}
            {showCcBcc && (
                <div className='px-4 py-2 space-y-2 border-b flex-shrink-0'>
                    <TagInput
                        label='Cc'
                        onChange={setCcValues}
                        placeholder='Empfänger/-in hinzufügen'
                        value={ccValues}
                    />
                    <TagInput
                        label='Bcc'
                        onChange={setBccValues}
                        placeholder='Empfänger/-in hinzufügen'
                        value={bccValues}
                    />
                </div>
            )}

            {/* Subject Field */}
            <div className='px-4 py-2 border-b flex-shrink-0'>
                <Input 
                    id='subject' 
                    placeholder='Betreff' 
                    value={subject} 
                    onChange={(e) => setSubject(e.target.value)} 
                    className="h-8 text-sm border-0 focus-visible:ring-0" 
                />
            </div>

            {/* Editor Area with Top Right Buttons */}
            <div className='flex-1 flex flex-col min-h-0 relative'>
                {/* Top Right Buttons */}
                <div className='absolute top-2 right-2 z-10 flex items-center gap-2'>
                    <AIComposeButton 
                        isComposing={defaultToolbarExpanded} 
                        onGenerate={onGenerate}
                        onFeedbackIdChange={onFeedbackIdChange}
                    />
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                            // Placeholder for future STT functionality
                            console.log('Mic button clicked - STT to be implemented')
                        }}
                    >
                        <div className="relative">
                            <Mic className="h-4 w-4" />
                            <Sparkles className="h-2 w-2 absolute -top-1 -right-1" />
                        </div>
                    </Button>
                </div>

                {/* Editor Content */}
                <div className='flex-1 overflow-y-auto relative'>
                <EditorContent editor={editor} />
                    {isEditorFocused && (!editor?.getText() || !editor.getText().trim()) && cursorPosition <= 1 && (
                        <div className='absolute top-3 left-4 pointer-events-none text-muted-foreground text-sm'>
                            Schreibe oder drücke die Leertaste für KI...
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Toolbar and Send Button */}
            <div className='px-4 py-2 flex items-center justify-between border-t bg-muted/30 flex-shrink-0'>
                {/* Send Button with Dropdown and Scheduled Date */}
                <div className='flex items-center gap-2'>
                    <div className="flex items-center">
                        <Button 
                            size="sm"
                            className="h-8 px-4 bg-primary text-primary-foreground hover:bg-primary/90 rounded-r-none border-r-0"
                            onClick={async () => {
                                await handleSend(value)
                            }}
                            disabled={isSending}
                        >
                            {isSending ? 'Sending...' : 'Senden'}
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button 
                                    size="sm"
                                    className="h-8 px-1 bg-primary text-primary-foreground hover:bg-primary/90 rounded-l-none"
                                    disabled={isSending}
                                >
                                    <ChevronDown className="h-3 w-3" />
                                </Button>
                            </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-64">
                            <DropdownMenuLabel>Versand planen</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleScheduleDate(getTomorrowMorning())}>
                                <div className="flex items-center gap-2 w-full">
                                    <div className="w-6 h-6 rounded bg-red-500 flex items-center justify-center text-white text-xs font-semibold">
                                        {format(getTomorrowMorning(), 'EEEE', { locale: de }).substring(0, 2).toUpperCase()}
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-sm">Morgen früh</div>
                                        <div className="text-xs text-muted-foreground">
                                            {format(getTomorrowMorning(), 'd. MMMM um HH:mm', { locale: de })}
                                        </div>
                                    </div>
                                </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleScheduleDate(getTomorrowAfternoon())}>
                                <div className="flex items-center gap-2 w-full">
                                    <div className="w-6 h-6 rounded bg-red-500 flex items-center justify-center text-white text-xs font-semibold">
                                        {format(getTomorrowAfternoon(), 'EEEE', { locale: de }).substring(0, 2).toUpperCase()}
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-sm">Morgen Nachmittag</div>
                                        <div className="text-xs text-muted-foreground">
                                            {format(getTomorrowAfternoon(), 'd. MMMM um HH:mm', { locale: de })}
                                        </div>
                                    </div>
                                </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleScheduleDate(getNextMondayMorning())}>
                                <div className="flex items-center gap-2 w-full">
                                    <div className="w-6 h-6 rounded bg-red-500 flex items-center justify-center text-white text-xs font-semibold">
                                        {format(getNextMondayMorning(), 'EEEE', { locale: de }).substring(0, 2).toUpperCase()}
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-sm">Montagmorgen</div>
                                        <div className="text-xs text-muted-foreground">
                                            {format(getNextMondayMorning(), 'd. MMMM um HH:mm', { locale: de })}
                                        </div>
                                    </div>
                                </div>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <Popover open={customDateOpen} onOpenChange={setCustomDateOpen}>
                                <PopoverTrigger asChild>
                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                        <div className="flex items-center gap-2 w-full">
                                            <Calendar className="h-4 w-4 text-primary" />
                                            <div className="flex-1">
                                                <div className="text-sm">Benutzerdefiniertes Datum</div>
                                            </div>
                                        </div>
                                    </DropdownMenuItem>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <div className="p-4 space-y-4">
                                        <div className="flex gap-2">
                                            <Input
                                                type="text"
                                                placeholder="Date"
                                                value={selectedDate ? format(selectedDate, 'MMM d, yyyy') : ''}
                                                readOnly
                                                className="flex-1"
                                            />
                                            <Input
                                                type="time"
                                                value={selectedTime}
                                                onChange={(e) => setSelectedTime(e.target.value)}
                                                className="w-32"
                                            />
                                        </div>
                                        <CalendarComponent
                                            mode="single"
                                            selected={selectedDate}
                                            onSelect={setSelectedDate}
                                            initialFocus
                                        />
                                        <div className="flex justify-end gap-2">
                                            <Button variant="outline" size="sm" onClick={() => setCustomDateOpen(false)}>
                                                Schließen
                                            </Button>
                                            <Button size="sm" onClick={handleCustomDateSave}>
                                                Speichern
                                            </Button>
                                        </div>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    </div>
                    {scheduledDate && (
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-primary">
                                {format(scheduledDate, 'MMM d, h:mm a', { locale: de })} {timezone}
                            </span>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={() => setScheduledDate(null)}
                            >
                                Entfernen
                            </Button>
                        </div>
                    )}
                </div>
                
                {/* Right Side Icons */}
                <div className='flex items-center gap-2'>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                            // File attachment functionality - to be implemented
                            console.log('Attachment clicked')
                        }}
                    >
                        <Paperclip className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                            // Delete draft functionality
                            if (onClose) {
                                // Clear all fields
                                setToValues([])
                                setCcValues([])
                                setBccValues([])
                                setSubject('')
                                if (editor) {
                                    editor.commands.clearContent()
                                }
                                onClose()
                            }
                        }}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* AI Compose Dialog */}
            <Dialog open={aiComposeOpen} onOpenChange={setAiComposeOpen}>
                <DialogContent 
                    className="sm:max-w-2xl p-0 border-0 bg-transparent shadow-none"
                    overlayClassName="bg-transparent"
                    showCloseButton={false}
                >
                    <div className="flex items-center gap-3 px-4 py-3 bg-muted/50 rounded-lg border">
                        {/* AI Icon */}
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-background flex items-center justify-center border">
                            <Bot className="h-4 w-4" />
                        </div>
                        
                        {/* Text Input */}
                        <input
                            type="text"
                            placeholder="Bitte die KI, eine E-Mail zu entwerfen..."
                            value={aiPrompt}
                            onChange={(e) => setAiPrompt(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && aiPrompt.trim()) {
                                    handleAiCompose(aiPrompt)
                                }
                            }}
                            className="flex-1 bg-transparent border-0 outline-none text-sm placeholder:text-muted-foreground"
                            autoFocus
                        />
                        
                        {/* Execute Button */}
                        <Button 
                            onClick={() => {
                                if (aiPrompt.trim()) {
                                    handleAiCompose(aiPrompt)
                                }
                            }}
                            size="icon"
                            className="h-8 w-8 rounded-full flex-shrink-0"
                            disabled={!aiPrompt.trim()}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                            </svg>
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}

export default EmailEditor
