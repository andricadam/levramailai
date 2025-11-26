'use client'
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"

import React from 'react'
import { generateEmail } from "./action"
import { readStreamableValue } from "@ai-sdk/rsc"
import { Bot, Loader2 } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import useThreads from "../../../../use-Threads"
import { useThread } from "../../../../use-thread"
import { turndown } from '@/lib/turndown'
import { toast } from 'sonner'

type Props = {
    onGenerate: (value: string) => void
    isComposing?: boolean
    onFeedbackIdChange?: (feedbackId: string | null) => void // Callback for feedback ID
}

const AIComposeButton = (props: Props) => {
    const [prompt, setPrompt] = React.useState('')
    const [open, setOpen] = React.useState(false)
    const [isGenerating, setIsGenerating] = React.useState(false)
    const { account, threads, accountId } = useThreads()
    const [threadId] = useThread();
    const thread = threads?.find(t => t.id === threadId)
    const aiGenerate = async (prompt: string) => {
        if (!prompt.trim()) {
            toast.error('Please enter a prompt')
            return
        }

        setIsGenerating(true)
        try {
            let context = ''
            if (!props.isComposing && thread?.emails) {
                context = thread.emails.map(m => `Subject: ${m.subject}\nFrom: ${m.from.address}\n\n${turndown.turndown(m.body ?? m.bodySnippet ?? '')}`).join('\n\n')
            }

            const fullContext = context ? `${context}\n\nMy name is: ${account?.name ?? ''}` : `My name is: ${account?.name ?? ''}`
            
            // Pass metadata for feedback tracking
            const { output, feedbackId } = await generateEmail(fullContext, prompt, {
                accountId: accountId ?? undefined,
                threadId: threadId ?? undefined,
            })

            // Notify parent component of feedback ID
            if (feedbackId && props.onFeedbackIdChange) {
                props.onFeedbackIdChange(feedbackId);
            }

            let accumulatedText = ''
            for await (const delta of readStreamableValue(output as any)) {
                if (delta) {
                    accumulatedText += delta
                    props.onGenerate(accumulatedText);
                }
            }
        } catch (error) {
            console.error('Error generating email:', error)
            toast.error('Failed to generate email. Please try again.')
        } finally {
            setIsGenerating(false)
        }
    }
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button onClick={() => setOpen(true)} size='icon' variant={'outline'}>
                    <Bot className="size-5" />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>AI Compose</DialogTitle>
                    <DialogDescription>
                        AI will compose an email based on the context of your previous emails.
                    </DialogDescription>
                    <div className="h-2"></div>
                    <Textarea
                        placeholder="What would you like to compose?"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        disabled={isGenerating}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                e.preventDefault()
                                aiGenerate(prompt)
                            }
                        }}
                    />
                    <div className="h-2"></div>
                    <Button 
                        onClick={() => { 
                            aiGenerate(prompt)
                            setOpen(false)
                            setPrompt('') 
                        }} 
                        disabled={isGenerating || !prompt.trim()}
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 className="size-4 animate-spin mr-2" />
                                Generating...
                            </>
                        ) : (
                            'Generate'
                        )}
                    </Button>
                </DialogHeader>
            </DialogContent>
        </Dialog>

    )
}

export default AIComposeButton