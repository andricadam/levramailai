'use client'
import EmailEditor from './email-editor/index'
import { api, type RouterOutputs } from '@/trpc/react'
import useThreads from '@/hooks/use-threads'
import { useState } from 'react'
import React from 'react'
import type { EmailAddress } from '@/types'
import { toast } from 'sonner'

const ReplyBox = ({ onSent }: { onSent?: () => void }) => {
    const { threadId, accountId } = useThreads()
    const { data: replyDetails } = api.account.getReplyDetails.useQuery({
        threadId: threadId ?? "",
        accountId: accountId ?? ""
    }, { enabled: !!threadId && !!accountId })

    if (!replyDetails) return null

    return <Component replyDetails={replyDetails} onSent={onSent} />
}

const Component = ({ replyDetails, onSent }: { replyDetails: RouterOutputs['account']['getReplyDetails'], onSent?: () => void }) => {
    const { threadId, accountId } = useThreads()
    const [subject, setSubject] = React.useState(replyDetails.subject || '')
    const [toValues, setToValues] = useState<{ label: string, value: string }[]>(
        replyDetails.to.map(item => {
            const address: string = typeof item === 'string' ? item : item.address
            return { label: address, value: address }
        })
    )

    React.useEffect(() => {
      if (!threadId || !replyDetails) return

      if (!replyDetails.subject.startsWith("Re:")) {
        setSubject(`Re: ${replyDetails.subject}`)
      } else {
        setSubject(replyDetails.subject)
      }

      setToValues(replyDetails.to.map(item => {
        const address: string = typeof item === 'string' ? item : item.address
        return { label: address, value: address }
      }))
      setCcValues(replyDetails.cc.map(item => {
        const address: string = typeof item === 'string' ? item : item.address
        return { label: address, value: address }
      }))

    }, [threadId, replyDetails])
    
    const [ccValues, setCcValues] = React.useState<{ label: string, value: string }[]>(
        replyDetails.cc.map(item => {
            const address: string = typeof item === 'string' ? item : item.address
            return { label: address, value: address }
        })
    )
    const [isSending, setIsSending] = useState(false)
    const [instantReplyFeedbackId, setInstantReplyFeedbackId] = React.useState<string | null>(null)

    const sendEmail = api.account.sendEmail.useMutation()

    const handleSend = async (value: string) => {
        if (!replyDetails) return
        sendEmail.mutate({
            accountId: accountId ?? "",
            threadId: threadId ?? undefined,
            body: value,
            subject: subject,
            from: replyDetails.from,
            to: replyDetails.to.map(to => ({ address: to.address, name: to.name ?? "" })),
            cc: replyDetails.cc.map(cc => ({ address: cc.address, name: cc.name ?? "" })),
            replyTo: [replyDetails.from],
            inReplyTo: replyDetails.id,
            instantReplyFeedbackId: instantReplyFeedbackId ?? undefined, // Pass feedback ID
        }, {
            onSuccess: () => {
                toast.success('Email sent successfully')
                setInstantReplyFeedbackId(null) // Reset
                onSent?.()
            },
            onError: (error) => {
                console.log(error)
                toast.error('Failed to send email')
            }
        })
    }

    const to = toValues.map(v => v.value)

    return (
        <div className="max-h-[300px] flex flex-col w-full m-0">
            <EmailEditor
                subject={subject}
                setSubject={setSubject}
                toValues={toValues}
                setToValues={setToValues}
                ccValues={ccValues}
                setCcValues={setCcValues}
                to={replyDetails.to.map(to => to.address)}
                handleSend={handleSend}
                isSending={isSending}
                defaultToolbarExpanded={false}
                initialDraft={replyDetails.autoReplyDraft}
                onFeedbackIdChange={setInstantReplyFeedbackId}
            />
        </div>
    )
}

export default ReplyBox

