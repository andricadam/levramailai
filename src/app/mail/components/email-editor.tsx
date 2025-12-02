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
import { improveText } from './ai/improve-text'
import { readStreamableValue } from '@ai-sdk/rsc'
import { X, Minus, Sparkles, Mic, Bot, Paperclip, Trash2, ChevronDown, Calendar, Loader2, Pencil, MessageCircle, Bold, Italic, Underline, Strikethrough, Check, RotateCcw } from 'lucide-react'
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
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
    const [isAiComposing, setIsAiComposing] = React.useState(false)
    const [scheduledDate, setScheduledDate] = React.useState<Date | null>(null)
    const [customDateOpen, setCustomDateOpen] = React.useState(false)
    const [scheduleDropdownOpen, setScheduleDropdownOpen] = React.useState(false)
    const [selectedDate, setSelectedDate] = React.useState<Date>()
    const [selectedTime, setSelectedTime] = React.useState<string>('12:00')
    const [selectedTimezone, setSelectedTimezone] = React.useState<string>('GMT+01')
    const insertedTextRef = React.useRef<string>('')
    const aiGenerateRef = React.useRef<((editorInstance: any) => Promise<void>) | null>(null)
    const { account: accountData, threads, accountId } = useThreads()
    const [threadId] = useThread()
    const thread = threads?.find((t: { id: string }) => t.id === threadId)
    const [attachments, setAttachments] = React.useState<File[]>([])
    const fileInputRef = React.useRef<HTMLInputElement>(null)
    
    // Text improvement state
    const [textSuggestion, setTextSuggestion] = React.useState<{
        improvedText: string
        originalText: string
        from: number
        to: number
    } | null>(null)
    const [isImprovingText, setIsImprovingText] = React.useState(false)
    const [suggestionPosition, setSuggestionPosition] = React.useState<{ x: number; y: number } | null>(null)

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
        setScheduleDropdownOpen(false)
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

    const handleAttachmentClick = () => {
        fileInputRef.current?.click()
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (files) {
            const newFiles = Array.from(files)
            setAttachments((prev: File[]) => [...prev, ...newFiles])
        }
        // Reset input so the same file can be selected again
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    const handleRemoveAttachment = (index: number) => {
        setAttachments((prev: File[]) => prev.filter((_: File, i: number) => i !== index))
    }

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes'
        const k = 1024
        const sizes = ['Bytes', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
    }

    const handleAiCompose = async (prompt: string) => {
        setIsAiComposing(true)
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
        setIsAiComposing(false)
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
    const [toolbarPosition, setToolbarPosition] = React.useState<{ x: number; y: number } | null>(null)
    const [hasSelection, setHasSelection] = React.useState(false)
    const editorContainerRef = React.useRef<HTMLDivElement>(null)

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
        onUpdate: ({ editor }: { editor: any }) => {
            setValue(editor.getHTML())
            // Update cursor position
            const { from } = editor.state.selection
            setCursorPosition(from)
        },
        onSelectionUpdate: ({ editor }: { editor: any }) => {
            // Update cursor position on selection change
            const { from, to } = editor.state.selection
            setCursorPosition(from)
            
            // Check if there's a text selection (not just a cursor)
            const hasTextSelection = from !== to
            
            if (hasTextSelection && editor.view) {
                try {
                    // Get the start position of the selection
                    const startPos = editor.view.coordsAtPos(from)
                    
                    if (startPos && editorContainerRef.current) {
                        const containerRect = editorContainerRef.current.getBoundingClientRect()
                        
                        // Calculate position relative to the editor container
                        // X-axis: fixed position (left edge of text content)
                        const x = 16 // Fixed left padding (px-4 = 16px)
                        
                        // Y-axis: position above the selected text
                        const y = startPos.top - containerRect.top - 8 // 8px above the selection
                        
                        setToolbarPosition({ x, y })
                        setHasSelection(true)
                        
                        // Close suggestion if a new selection is made (different from the one with suggestion)
                        if (textSuggestion && (from !== textSuggestion.from || to !== textSuggestion.to)) {
                            setTextSuggestion(null)
                            setSuggestionPosition(null)
                        }
                    }
                } catch (error) {
                    // Silently handle any coordinate calculation errors
                    console.debug('Error calculating toolbar position:', error)
                }
            } else {
                setHasSelection(false)
                setToolbarPosition(null)
                // Close suggestion if selection is cleared
                if (textSuggestion) {
                    setTextSuggestion(null)
                    setSuggestionPosition(null)
                }
            }
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
        onBlur: ({ event }: { event: FocusEvent }) => {
            // Don't hide toolbar if clicking on toolbar buttons
            const target = event.relatedTarget as HTMLElement
            if (target && editorContainerRef.current?.contains(target)) {
                return // Keep toolbar visible if clicking within editor container
            }
            
            setIsEditorFocused(false)
            // Hide toolbar when editor loses focus (with small delay to allow button clicks)
            setTimeout(() => {
                setHasSelection(false)
                setToolbarPosition(null)
            }, 200)
            // Don't close suggestion on blur - let user interact with buttons
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

    // Handle mouseup events to update selection toolbar
    React.useEffect(() => {
        if (!editor) return

        const handleMouseUp = () => {
            // Small delay to ensure selection is updated
            setTimeout(() => {
                if (!editor.view) return
                
                const { state } = editor
                const { from, to } = state.selection
                const hasTextSelection = from !== to
                
                if (hasTextSelection) {
                    try {
                        const startPos = editor.view.coordsAtPos(from)
                        
                        if (startPos && editorContainerRef.current) {
                            const containerRect = editorContainerRef.current.getBoundingClientRect()
                            
                            // Calculate position relative to the editor container
                            // X-axis: fixed position (left edge of text content)
                            const x = 16 // Fixed left padding (px-4 = 16px)
                            
                            // Y-axis: position above the selected text
                            const y = startPos.top - containerRect.top - 8 // 8px above the selection
                            
                            setToolbarPosition({ x, y })
                            setHasSelection(true)
                        }
                    } catch (error) {
                        // Silently handle any coordinate calculation errors
                        console.debug('Error calculating toolbar position:', error)
                    }
                } else {
                    setHasSelection(false)
                    setToolbarPosition(null)
                }
            }, 10)
        }

        const editorElement = editor.view?.dom
        if (editorElement) {
            editorElement.addEventListener('mouseup', handleMouseUp)
            return () => {
                editorElement.removeEventListener('mouseup', handleMouseUp)
            }
        }
    }, [editor])

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
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSubject(e.target.value)} 
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
                <div 
                    ref={editorContainerRef}
                    className='flex-1 overflow-y-auto relative'
                >
                    {/* Floating Toolbar - appears when text is selected */}
                    {hasSelection && toolbarPosition && (
                        <div
                            className="absolute z-30 flex items-center gap-1 px-2 py-1.5 bg-muted/95 backdrop-blur-sm rounded-lg shadow-lg border border-border/50"
                            style={{
                                left: `${toolbarPosition.x}px`,
                                top: `${toolbarPosition.y}px`,
                                transform: 'translateY(-100%)',
                            }}
                            onMouseDown={(e: React.MouseEvent) => {
                                // Prevent toolbar from closing when clicking on it, but allow button clicks
                                // Only prevent default if clicking on the container itself, not buttons
                                if (e.target === e.currentTarget) {
                                    e.preventDefault()
                                }
                            }}
                        >
                            {/* Text verbessern Button */}
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 gap-1.5 text-xs"
                                onMouseDown={(e: React.MouseEvent<HTMLButtonElement>) => {
                                    // Prevent default to stop editor blur
                                    e.preventDefault()
                                    e.stopPropagation()
                                }}
                                onClick={async (e: React.MouseEvent<HTMLButtonElement>) => {
                                    e.stopPropagation()
                                    
                                    if (!editor || !editorContainerRef.current) {
                                        console.log('Editor or container not available')
                                        return
                                    }
                                    
                                    // Capture selection immediately before any blur can happen
                                    const { from, to } = editor.state.selection
                                    if (from === to) {
                                        console.log('No text selected')
                                        return
                                    }
                                    
                                    const selectedText = editor.state.doc.textBetween(from, to)
                                    if (!selectedText.trim()) {
                                        console.log('Selected text is empty')
                                        return
                                    }
                                    
                                    console.log('Improving text:', selectedText)
                                    
                                    // Store selection values to use even if editor loses focus
                                    const selectionFrom = from
                                    const selectionTo = to
                                    
                                    // Calculate position for suggestion (below the selected text)
                                    try {
                                        const endPos = editor.view.coordsAtPos(selectionTo)
                                        if (endPos && editorContainerRef.current) {
                                            const containerRect = editorContainerRef.current.getBoundingClientRect()
                                            const x = 16 // Fixed left padding (px-4 = 16px)
                                            const y = endPos.bottom - containerRect.top + 8 // 8px below the selection
                                            setSuggestionPosition({ x, y })
                                        }
                                    } catch (error) {
                                        console.debug('Error calculating suggestion position:', error)
                                    }
                                    
                                    setIsImprovingText(true)
                                    try {
                                        const improvedText = await improveText(selectedText)
                                        console.log('Improved text received:', improvedText)
                                        setTextSuggestion({
                                            improvedText,
                                            originalText: selectedText,
                                            from: selectionFrom,
                                            to: selectionTo
                                        })
                                    } catch (error) {
                                        console.error('Failed to improve text:', error)
                                        setSuggestionPosition(null)
                                    } finally {
                                        setIsImprovingText(false)
                                    }
                                }}
                                disabled={isImprovingText}
                            >
                                {isImprovingText ? (
                                    <>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        <span>Verbessern...</span>
                                    </>
                                ) : (
                                    <>
                                        <Pencil className="h-3.5 w-3.5" />
                                        <span>Text verbessern</span>
                                    </>
                                )}
                            </Button>

                            {/* Frag Levra Button */}
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 gap-1.5 text-xs"
                            >
                                <MessageCircle className="h-3.5 w-3.5" />
                                <span>Frag Levra</span>
                            </Button>

                            {/* Separator */}
                            <div className="h-4 w-px bg-border mx-1" />

                            {/* Text Dropdown */}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2 gap-1 text-xs"
                                    >
                                        <span>Text</span>
                                        <ChevronDown className="h-3 w-3" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    {/* Dropdown content will be added later */}
                                </DropdownMenuContent>
                            </DropdownMenu>

                            {/* Bold Button */}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => editor?.chain().focus().toggleBold().run()}
                            >
                                <Bold className="h-4 w-4" />
                            </Button>

                            {/* Italic Button */}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => editor?.chain().focus().toggleItalic().run()}
                            >
                                <Italic className="h-4 w-4" />
                            </Button>

                            {/* Underline Button */}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => editor?.chain().focus().toggleUnderline().run()}
                            >
                                <Underline className="h-4 w-4" />
                            </Button>

                            {/* Strikethrough Button */}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => editor?.chain().focus().toggleStrike().run()}
                            >
                                <Strikethrough className="h-4 w-4" />
                            </Button>

                            {/* Attachment Button */}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Paperclip className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                    
                    <EditorContent editor={editor} />
                    {isEditorFocused && (!editor?.getText() || !editor.getText().trim()) && cursorPosition <= 1 && (
                        <div className='absolute top-3 left-4 pointer-events-none text-muted-foreground text-sm'>
                            Schreibe oder drücke die Leertaste für KI...
                        </div>
                    )}
                    
                    {/* Text Suggestion UI */}
                    {textSuggestion && editor && suggestionPosition && (
                        <div 
                            className="absolute z-40 bg-background border rounded-lg shadow-lg p-3"
                            style={{
                                left: `${suggestionPosition.x}px`,
                                top: `${suggestionPosition.y}px`,
                                minWidth: '300px',
                                maxWidth: 'calc(100% - 32px)',
                            }}
                            onMouseDown={(e) => {
                                // Prevent suggestion from closing when clicking on it
                                e.preventDefault()
                            }}
                        >
                            <div className="space-y-3">
                                {/* Original text with highlight */}
                                <div className="text-sm">
                                    <div className="text-xs text-muted-foreground mb-1">Original:</div>
                                    <div className="bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded text-foreground">
                                        {textSuggestion.originalText}
                                    </div>
                                </div>
                                
                                {/* Improved text suggestion */}
                                <div className="text-sm">
                                    <div className="text-xs text-muted-foreground mb-1">Verbessert:</div>
                                    <div className="bg-blue-500/20 dark:bg-blue-500/30 px-2 py-1 rounded text-foreground">
                                        {textSuggestion.improvedText}
                                    </div>
                                </div>
                                
                                {/* Action buttons */}
                                <div className="flex items-center gap-2 pt-1 border-t border-border">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 px-3 gap-2 text-xs flex-1"
                                        onClick={() => {
                                            if (!editor || !textSuggestion) return
                                            
                                            // Replace the selected text with improved text
                                            editor
                                                .chain()
                                                .focus()
                                                .setTextSelection({ from: textSuggestion.from, to: textSuggestion.to })
                                                .deleteSelection()
                                                .insertContent(textSuggestion.improvedText)
                                                .run()
                                            
                                            setTextSuggestion(null)
                                            setSuggestionPosition(null)
                                        }}
                                    >
                                        <Check className="h-3.5 w-3.5" />
                                        Zustimmen
                                    </Button>
                                    
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 px-3 gap-2 text-xs flex-1"
                                        onClick={() => {
                                            setTextSuggestion(null)
                                            setSuggestionPosition(null)
                                        }}
                                    >
                                        <X className="h-3.5 w-3.5" />
                                        Verwerfen
                                    </Button>
                                    
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 px-3 gap-2 text-xs flex-1"
                                        onClick={async () => {
                                            if (!editor || !textSuggestion) return
                                            
                                            setIsImprovingText(true)
                                            try {
                                                const improvedText = await improveText(textSuggestion.originalText)
                                                setTextSuggestion({
                                                    ...textSuggestion,
                                                    improvedText
                                                })
                                                
                                                // Update position when retrying
                                                try {
                                                    const endPos = editor.view.coordsAtPos(textSuggestion.to)
                                                    if (endPos && editorContainerRef.current) {
                                                        const containerRect = editorContainerRef.current.getBoundingClientRect()
                                                        const x = 16
                                                        const y = endPos.bottom - containerRect.top + 8
                                                        setSuggestionPosition({ x, y })
                                                    }
                                                } catch (error) {
                                                    console.debug('Error updating suggestion position:', error)
                                                }
                                            } catch (error) {
                                                console.error('Failed to improve text:', error)
                                            } finally {
                                                setIsImprovingText(false)
                                            }
                                        }}
                                        disabled={isImprovingText}
                                    >
                                        {isImprovingText ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                            <RotateCcw className="h-3.5 w-3.5" />
                                        )}
                                        Erneut versuchen
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Attachments Display */}
            {attachments.length > 0 && (
                <div className='px-4 py-2 border-t bg-muted/20 flex-shrink-0'>
                    <div className='flex flex-wrap gap-2'>
                        {attachments.map((file: File, index: number) => (
                            <div
                                key={index}
                                className='flex items-center gap-2 px-3 py-1.5 bg-background border rounded-md text-sm'
                            >
                                <Paperclip className="h-3 w-3 text-muted-foreground" />
                                <span className='text-xs max-w-[200px] truncate' title={file.name}>
                                    {file.name}
                                </span>
                                <span className='text-xs text-muted-foreground'>
                                    ({formatFileSize(file.size)})
                                </span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 ml-1"
                                    onClick={() => handleRemoveAttachment(index)}
                                >
                                    <X className="h-3 w-3" />
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

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
                        <DropdownMenu open={scheduleDropdownOpen} onOpenChange={setScheduleDropdownOpen}>
                            <DropdownMenuTrigger asChild>
                                <Button 
                                    size="sm"
                                    className="h-8 px-1 bg-primary text-primary-foreground hover:bg-primary/90 rounded-l-none"
                                    disabled={isSending}
                                >
                                    <ChevronDown className="h-3 w-3" />
                                </Button>
                            </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-64" onCloseAutoFocus={(e) => {
                            // Prevent closing when Popover is open
                            if (customDateOpen) {
                                e.preventDefault()
                            }
                        }}>
                            <DropdownMenuLabel>Versand planen</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                                onClick={() => handleScheduleDate(getTomorrowMorning())}
                                className="cursor-pointer hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground transition-colors"
                            >
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
                            <DropdownMenuItem 
                                onClick={() => handleScheduleDate(getTomorrowAfternoon())}
                                className="cursor-pointer hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground transition-colors"
                            >
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
                            <DropdownMenuItem 
                                onClick={() => handleScheduleDate(getNextMondayMorning())}
                                className="cursor-pointer hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground transition-colors"
                            >
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
                            <Popover open={customDateOpen}                             onOpenChange={(open: boolean) => {
                                setCustomDateOpen(open)
                                if (open && !selectedDate) {
                                    setSelectedDate(new Date())
                                }
                                // Keep dropdown open when popover opens
                                if (open) {
                                    setScheduleDropdownOpen(true)
                                }
                            }} modal={false}>
                                <PopoverTrigger asChild>
                                    <DropdownMenuItem 
                                        onSelect={(e: Event) => {
                                            e.preventDefault()
                                            setCustomDateOpen(true)
                                        }}
                                        className="cursor-pointer hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground transition-colors"
                                    >
                                        <div className="flex items-center gap-2 w-full">
                                            <Calendar className="h-4 w-4 text-primary" />
                                            <div className="flex-1">
                                                <div className="text-sm">Benutzerdefiniertes Datum</div>
                                            </div>
                                        </div>
                                    </DropdownMenuItem>
                                </PopoverTrigger>
                                <PopoverContent 
                                    className="w-auto p-0" 
                                    align="start"
                                    onInteractOutside={(e: Event) => {
                                        // Prevent closing when clicking outside
                                        e.preventDefault()
                                    }}
                                    onEscapeKeyDown={(e: KeyboardEvent) => {
                                        // Prevent closing on escape, only close on button clicks
                                        e.preventDefault()
                                    }}
                                >
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
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedTime(e.target.value)}
                                                className="w-32"
                                            />
                                        </div>
                                        <Select value={selectedTimezone} onValueChange={setSelectedTimezone}>
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Select timezone" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="GMT+01">GMT+01 Zurich</SelectItem>
                                                <SelectItem value="GMT+00">GMT+00 London</SelectItem>
                                                <SelectItem value="GMT-05">GMT-05 New York</SelectItem>
                                                <SelectItem value="GMT-08">GMT-08 Los Angeles</SelectItem>
                                                <SelectItem value="GMT+09">GMT+09 Tokyo</SelectItem>
                                                <SelectItem value="GMT+02">GMT+02 Berlin</SelectItem>
                                                <SelectItem value="GMT+08">GMT+08 Beijing</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <CalendarComponent
                                            mode="single"
                                            selected={selectedDate}
                                            onSelect={setSelectedDate}
                                            initialFocus
                                        />
                                        <div className="flex justify-end gap-2">
                                            <Button variant="outline" size="sm" onClick={() => {
                                                setCustomDateOpen(false)
                                            }}>
                                                Schließen
                                            </Button>
                                            <Button size="sm" onClick={() => {
                                                handleCustomDateSave()
                                                setCustomDateOpen(false)
                                                setScheduleDropdownOpen(false)
                                            }}>
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
                                {format(scheduledDate, 'MMM d, h:mm a', { locale: de })} {selectedTimezone}
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
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleFileSelect}
                    />
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                                onClick={handleAttachmentClick}
                            >
                                <Paperclip className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Datei anhängen</p>
                        </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => {
                                    // Delete draft functionality
                                    if (onClose) {
                                        // Clear all fields
                                        setToValues([])
                                        setCcValues([])
                                        setBccValues([])
                                        setSubject('')
                                        setAttachments([])
                                        if (editor) {
                                            editor.commands.clearContent()
                                        }
                                        onClose()
                                    }
                                }}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Entwurf löschen</p>
                        </TooltipContent>
                    </Tooltip>
                </div>
            </div>

            {/* AI Compose Dialog */}
            <Dialog open={aiComposeOpen} onOpenChange={setAiComposeOpen}>
                <DialogContent 
                    className="sm:max-w-2xl p-0 border-0 bg-transparent shadow-none"
                    overlayClassName="bg-transparent"
                    showCloseButton={false}
                >
                    <DialogTitle className="sr-only">AI E-Mail erstellen</DialogTitle>
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
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAiPrompt(e.target.value)}
                            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                                if (e.key === 'Enter' && aiPrompt.trim() && !isAiComposing) {
                                    handleAiCompose(aiPrompt)
                                }
                            }}
                            className="flex-1 bg-transparent border-0 outline-none text-sm placeholder:text-muted-foreground"
                            autoFocus
                        />
                        
                        {/* Execute Button */}
                        <Button 
                            onClick={() => {
                                if (aiPrompt.trim() && !isAiComposing) {
                                    handleAiCompose(aiPrompt)
                                }
                            }}
                            size="icon"
                            className={`h-8 w-8 rounded-full flex-shrink-0 transition-all ${
                                isAiComposing 
                                    ? 'bg-primary text-primary-foreground cursor-wait' 
                                    : ''
                            }`}
                            disabled={!aiPrompt.trim() || isAiComposing}
                        >
                            {isAiComposing ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                                </svg>
                            )}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}

export default EmailEditor
