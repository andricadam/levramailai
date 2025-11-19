'use client'
import EmailEditor from './email-editor'
import { api, type RouterOutputs } from '@/trpc/react'
import useThreads from '@/hooks/use-threads'
import { useState } from 'react'
import React from 'react'

const ReplyBox = () => {
    const { threadId, accountId } = useThreads()
    const { data: replyDetails } = api.account.getReplyDetails.useQuery({
        threadId: threadId ?? "",
        accountId: accountId ?? ""
    }, { enabled: !!threadId && !!accountId })

    if (!replyDetails) return null

    return <Component replyDetails={replyDetails} />
}

const Component = ({ replyDetails }: { replyDetails: RouterOutputs['account']['getReplyDetails'] }) => {
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

    const handleSend = async (value: string) => {
        setIsSending(true)
        try {
            // TODO: Implement send email logic
            console.log('Sending email:', { subject, toValues, ccValues, body: value, threadId, accountId })
        } finally {
            setIsSending(false)
        }
    }

    const to = toValues.map(v => v.value)

    return (
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
            defaultToolbarExpanded={true}
        />
    )
}

export default ReplyBox

