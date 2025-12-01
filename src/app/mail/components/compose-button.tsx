'use client'
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Pencil, X, Minus } from "lucide-react"

import React from 'react'
import EmailEditor from "./email-editor"
import { api } from "@/trpc/react"
import { useLocalStorage } from "usehooks-ts"
import { toast } from "sonner"

const ComposeButton = () => {
    const [open, setOpen] = React.useState(false)
    const [accountId] = useLocalStorage('accountId', '')
    const [toValues, setToValues] = React.useState<{ label: string; value: string; }[]>([])
    const [ccValues, setCcValues] = React.useState<{ label: string; value: string; }[]>([])
    const [subject, setSubject] = React.useState<string>('')
    const [instantReplyFeedbackId, setInstantReplyFeedbackId] = React.useState<string | null>(null)
    
    // Only query when accountId is valid (non-empty string)
    const isValidAccountId = Boolean(accountId && typeof accountId === 'string' && accountId.trim().length > 0)
    const { data: account } = api.account.getMyAccount.useQuery(
        { accountId: accountId || '' },
        { 
            enabled: isValidAccountId, 
            retry: false,
        }
    )


    React.useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'c' && (event.ctrlKey || event.metaKey) && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName || '')) {
                event.preventDefault();
                setOpen(true);
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    const sendEmail = api.account.sendEmail.useMutation()

    const handleSend = async (value: string) => {
        if (!account) return
        sendEmail.mutate({
            accountId: account.id,
            threadId: undefined,
            body: value,
            subject: subject,
            from: { name: account.name ?? 'Me', address: account.emailAddress ?? 'me@example.com' },
            to: toValues.map(to => ({ name: to.value, address: to.value })),
            cc: ccValues.map(cc => ({ name: cc.value, address: cc.value })),
            replyTo: [{ name: account.name ?? 'Me', address: account.emailAddress ?? 'me@example.com' }],
            inReplyTo: undefined,
            instantReplyFeedbackId: instantReplyFeedbackId ?? undefined, // Pass feedback ID
        }, {
            onSuccess: () => {
                toast.success("Email sent")
                setInstantReplyFeedbackId(null) // Reset
                setOpen(false)
            },
            onError: (error) => {
                console.log(error)
                toast.error(error.message)
            }
        })
    }


    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Pencil className='size-4 mr-1' />
                    Compose
                </Button>
            </DialogTrigger>
            <DialogContent 
                className="max-w-[calc(100%-2rem)] sm:max-w-7xl h-[90vh] p-0 flex flex-col overflow-hidden"
                overlayClassName="bg-background/80 backdrop-blur-[0.5px]"
                showCloseButton={false}
            >
                <div className="flex-1 overflow-hidden flex flex-col">
                    <EmailEditor
                        toValues={toValues}
                        setToValues={setToValues}
                        ccValues={ccValues}
                        setCcValues={setCcValues}
                        subject={subject}
                        setSubject={setSubject}
                        account={account}
                        to={toValues.map(to => to.value)}
                        defaultToolbarExpanded={true}
                        handleSend={handleSend}
                        isSending={sendEmail.isPending}
                        onFeedbackIdChange={setInstantReplyFeedbackId}
                        onClose={() => setOpen(false)}
                    />
                </div>
            </DialogContent>
        </Dialog>
    )
}

export default ComposeButton