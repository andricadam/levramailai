'use client'
import { turndown } from '@/lib/turndown'
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
import { Sparkles } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import useThreads from "@/hooks/use-threads"
import { useThread } from "../use-thread"

type Props = {
    onGenerate: (value: string) => void
    isComposing?: boolean
}

const AIComposeButton = (props: Props) => {
    const [prompt, setPrompt] = React.useState('')
    const [open, setOpen] = React.useState(false)
    const { account, threads } = useThreads()
    const [threadId] = useThread();
    const thread = threads?.find(t => t.id === threadId)
    const aiGenerate = async (prompt: string) => {
        let context: string | undefined = ''
        if (!props.isComposing) {
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
My name is ${account?.name} and my email is ${account?.emailAddress}.
`

        const { output } = await generateEmail(context, prompt)

        let accumulatedText = ''
        for await (const delta of readStreamableValue(output)) {
            if (delta) {
                accumulatedText += delta
                props.onGenerate(accumulatedText);
            }
        }

    }
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger>
                <Button onClick={() => setOpen(true)} size='icon' variant={'outline'}>
                    <Sparkles className="size-5" />
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
                    />
                    <div className="h-2"></div>
                    <Button onClick={() => { aiGenerate(prompt); setOpen(false); setPrompt('') }}>Generate</Button>
                </DialogHeader>
            </DialogContent>
        </Dialog>

    )
}

export default AIComposeButton