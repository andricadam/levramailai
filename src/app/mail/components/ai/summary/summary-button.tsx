'use client'
import { Button } from "@/components/ui/button"
import { Sparkles } from "lucide-react"
import React from 'react'
import { summarizeEmail } from "./action"
import { readStreamableValue } from "@ai-sdk/rsc"
import { toast } from "sonner"

type Props = {
    emailContent: string
    subject: string
    from: string
    sentAt: string
    onSummaryGenerated: (summary: string) => void
}

const SummaryButton = React.forwardRef<HTMLButtonElement, Props>((props, ref) => {
    const [isGenerating, setIsGenerating] = React.useState(false)

    const handleSummarize = async () => {
        if (!props.emailContent) {
            toast.error('No email content to summarize')
            return
        }

        setIsGenerating(true)
        try {
            const { output } = await summarizeEmail(
                props.emailContent,
                props.subject,
                props.from,
                props.sentAt
            )

            let accumulatedText = ''
            for await (const delta of readStreamableValue(output)) {
                if (delta) {
                    accumulatedText += delta
                    props.onSummaryGenerated(accumulatedText)
                }
            }
        } catch (error) {
            console.error('Error generating summary:', error)
            toast.error('Failed to generate summary. Please try again.')
        } finally {
            setIsGenerating(false)
        }
    }

    return (
        <Button
            ref={ref}
            onClick={handleSummarize}
            size="icon"
            variant="ghost"
            disabled={!props.emailContent || isGenerating}
            className="relative"
        >
            <Sparkles className={`w-4 h-4 ${isGenerating ? 'animate-pulse' : ''}`} />
            <span className="sr-only">Summarize email</span>
        </Button>
    )
})

SummaryButton.displayName = 'SummaryButton'

export default SummaryButton

