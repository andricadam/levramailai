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
import AIComposeButton from './ai-compose-button'
import { generate } from './action'
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
        <div>

            <div className='flex p-4 py-2 border-b'>
                <TipTapMenuBar editor={editor} />
            </div>

            <div className='p-4 pb-0 space-y-2'>
                {expanded && (
                    <>
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
                            value={toValues}
                        />
                        <Input id='subject' placeholder='Subject' value={subject} onChange={(e) => setSubject(e.target.value)} />
                    </>
                )}

                <div className='flex items-center gap-2'>
                    <div className='cursor-pointer' onClick={() => setExpanded(!expanded)}>
                        <span className='text-green-600 font-medium'>
                            Draft {" "}
                        </span>
                        <span>
                            to {to.join(', ')}
                        </span>
                    </div>
                    <AIComposeButton isComposing={defaultToolbarExpanded} onGenerate={onGenerate} />
                </div>

            </div>

            <div className='prose w-full px-4 min-h-[150px]'>
                <EditorContent editor={editor} />
            </div>

            <Separator />
            <div className='py-3 px-4 flex items-center justify-between'>
                <span className='text-sm'>
                    Tip: Press {" "}
                    <kbd className='px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-300 rounded'>
                        Cmd + J
                    </kbd> {" "}
                    for AI autocomplete
                </span>
                <Button onClick={async () => {
                    editor?.commands?.clearContent()
                    await handleSend(value)
                }} disabled={isSending}>
                    Send
                </Button>
            </div>
        </div>
    )
}

export default EmailEditor