'use client'
import React from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Text from '@tiptap/extension-text'
import TipTapMenuBar from './editor-menubar'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import TagInput from './tag-input'
import { Input } from '@/components/ui/input'
import AIComposeButton from './ai/compose/ai-compose-button'
import { generate } from './ai/autocomplete/action'
import { readStreamableValue } from '@ai-sdk/rsc'

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
}

const EmailEditor = ({ subject, setSubject, toValues, setToValues, ccValues, setCcValues, to, handleSend, isSending, defaultToolbarExpanded = false }: Props) => {
    const [value, setValue] = React.useState<string>('')
    const [expanded, setExpanded] = React.useState<boolean>(defaultToolbarExpanded)
    const insertedTextRef = React.useRef<string>('') // Track what's already been inserted
    const aiGenerateRef = React.useRef<((editorInstance: any) => Promise<void>) | null>(null)

    const aiGenerate = React.useCallback(async (editorInstance: any) => {
        if (!editorInstance) return
        const currentText = editorInstance.getText()
        const { output } = await generate(currentText)
        let accumulatedText = ''
        insertedTextRef.current = '' // Reset tracker
        
        for await (const delta of readStreamableValue(output)) {
            if (delta) {
                accumulatedText += delta
                // Only insert the new text that hasn't been inserted yet
                const newText = accumulatedText.slice(insertedTextRef.current.length)
                if (newText) {
                    editorInstance.commands.insertContent(newText)
                    insertedTextRef.current = accumulatedText
                }
            }
        }
    }, [])

    // Store the function in a ref so the extension can access it
    aiGenerateRef.current = aiGenerate

    const CustomText = Text.extend({
        addKeyboardShortcuts() {
            return {
                'Meta-j': () => {
                    // Call the async function without blocking
                    if (aiGenerateRef.current) {
                        aiGenerateRef.current(this.editor).catch(console.error)
                    }
                    return true
                }
            }
        },
    })

    const editor = useEditor({
        autofocus: false,
        immediatelyRender: false,
        extensions: [StarterKit, CustomText],
        onUpdate: ({ editor }) => {
            setValue(editor.getHTML())
        }
    })

    const onGenerate = React.useCallback((content: string) => {
        if (editor) {
            // Set content in the editor with the accumulated text
            editor.commands.setContent(content)
        }
    }, [editor])

    if (!editor) return null

    return (
        <div className="flex flex-col border-t bg-background m-0">
            {/* Compact Header */}
            <div className='flex items-center justify-between px-2.5 py-1.5 border-b bg-muted/30 flex-shrink-0'>
                <div className='flex items-center gap-2 flex-1 min-w-0'>
                    <div className='cursor-pointer flex items-center gap-1.5' onClick={() => setExpanded(!expanded)}>
                        <span className='text-green-600 dark:text-green-500 font-medium text-xs'>
                            Draft
                        </span>
                        <span className='text-xs text-muted-foreground truncate'>
                            to {to.join(', ')}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <AIComposeButton isComposing={defaultToolbarExpanded} onGenerate={onGenerate} />
                </div>
            </div>

            {/* Expandable Fields */}
            {expanded && (
                <div className='px-2.5 py-1.5 space-y-1.5 border-b bg-muted/20 flex-shrink-0'>
                    <TagInput
                        label='To'
                        onChange={setToValues}
                        placeholder='Add Recipients'
                        value={toValues}
                    />
                    <TagInput
                        label='Cc'
                        onChange={setCcValues}
                        placeholder='Add Recipients'
                        value={ccValues}
                    />
                    <Input id='subject' placeholder='Subject' value={subject} onChange={(e) => setSubject(e.target.value)} className="h-7 text-sm" />
                </div>
            )}

            {/* Compact Toolbar */}
            <div className='flex px-2 py-1 border-b bg-muted/10 flex-shrink-0'>
                <TipTapMenuBar editor={editor} />
            </div>

            {/* Compact Editor */}
            <div className='prose prose-sm w-full px-2.5 py-1.5 min-h-[80px] overflow-y-auto'>
                <EditorContent editor={editor} />
            </div>

            {/* Compact Footer - Flush Bottom */}
            <div className='px-2.5 py-1 flex items-center justify-between border-t bg-muted/30 flex-shrink-0 m-0'>
                <span className='text-[10px] text-muted-foreground'>
                    Tip: Press <kbd className='px-1 py-0.5 text-[10px] font-semibold text-muted-foreground bg-muted border rounded'>Cmd + J</kbd> for AI
                </span>
                <Button 
                    size="sm"
                    className="h-7 px-3 text-xs"
                    onClick={async () => {
                        editor?.commands?.clearContent()
                        await handleSend(value)
                    }} 
                    disabled={isSending}
                >
                    Send
                </Button>
            </div>
        </div>
    )
}

export default EmailEditor