'use client'
import { turndown } from '@/lib/turndown'
import { Button } from "@/components/ui/button"
import React from 'react'
import { generateInstantReply } from "./action"
import { readStreamableValue } from "@ai-sdk/rsc"
import { Zap } from "lucide-react"
import useThreads from "../../../use-Threads"
import { useThread } from "../../../use-thread"
import { toast } from "sonner"
import { api, type RouterOutputs } from '@/trpc/react'

type Thread = RouterOutputs["account"]["getThreads"][number]

type Props = {
    onGenerate: (value: string) => void
    isComposing?: boolean
    onFeedbackIdChange?: (feedbackId: string | null) => void // Callback for feedback ID
}

const InstantReplyButton = (props: Props) => {
    const { account, threads, accountId } = useThreads()
    const [threadId] = useThread();
    const thread = threads?.find((t: Thread) => t.id === threadId)
    const [isGenerating, setIsGenerating] = React.useState(false)

    // Fetch thread separately if not found in threads array, or when composing to ensure we have the latest data
    const { data: fetchedThread } = api.account.getThread.useQuery(
        {
            accountId: accountId ?? "",
            threadId: threadId ?? ""
        },
        {
            enabled: !!threadId && !!accountId && (!thread || props.isComposing),
            // Fetch if thread is not in the threads array, or when composing to get latest data
        }
    )

    // Use thread from array if available, otherwise use fetched thread
    const activeThread = thread ?? fetchedThread

    const handleInstantReply = async () => {
        // When composing, we can still generate a reply even if thread isn't fully loaded
        if (!props.isComposing && (!activeThread || !activeThread.emails || activeThread.emails.length === 0)) {
            toast.error('No email thread available for instant reply')
            return
        }

        setIsGenerating(true)
        try {
            let context: string | undefined = ''
            let originalEmailId: string | undefined = undefined
            
            if (!props.isComposing && activeThread?.emails) {
                // Get the most recent email (the one being replied to)
                const mostRecentEmail = activeThread.emails[activeThread.emails.length - 1];
                originalEmailId = mostRecentEmail.id;
                
                for (const email of activeThread.emails) {
                    const content = `
Subject: ${email.subject}
From: ${email.from?.address || email.from || 'Unknown'}
Sent: ${new Date(email.sentAt).toLocaleString()}
Body: ${turndown.turndown(email.body ?? email.bodySnippet ?? "")}

`
                    context += content
                }
            } else if (props.isComposing && activeThread?.emails) {
                // When composing, use the thread emails for context
                for (const email of activeThread.emails) {
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

            // Pass metadata for feedback tracking
            const { output, feedbackId } = await generateInstantReply(context, {
                accountId: accountId ?? undefined,
                threadId: threadId ?? undefined,
                originalEmailId,
            })

            // Notify parent component of feedback ID
            if (feedbackId && props.onFeedbackIdChange) {
                props.onFeedbackIdChange(feedbackId);
            }

            let accumulatedText = ''
            for await (const delta of readStreamableValue(output)) {
                if (delta) {
                    accumulatedText += delta
                    props.onGenerate(accumulatedText);
                }
            }
        } catch (error) {
            console.error('Error generating instant reply:', error)
            toast.error('Failed to generate instant reply. Please try again.')
        } finally {
            setIsGenerating(false)
        }
    }

    const hasEmails = activeThread?.emails && activeThread.emails.length > 0
    // Allow button to work when composing even if thread isn't fully loaded yet
    const isDisabled = isGenerating || (!props.isComposing && !hasEmails)

    return (
        <Button 
            onClick={handleInstantReply} 
            size='icon' 
            variant={'outline'}
            disabled={isDisabled}
            title="Instant Reply"
        >
            <Zap className={`size-5 ${isGenerating ? 'animate-pulse' : ''}`} />
        </Button>
    )
}

export default InstantReplyButton
