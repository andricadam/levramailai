'use client'
import { Button } from "@/components/ui/button"
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from "@/components/ui/drawer"
import { Pencil } from "lucide-react"

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
        <Drawer open={open} onOpenChange={setOpen}>
            <DrawerTrigger asChild>
                <Button>
                    <Pencil className='size-4 mr-1' />
                    Compose
                </Button>
            </DrawerTrigger>
            <DrawerContent className="">
                <DrawerHeader>
                    <DrawerTitle>Compose Email</DrawerTitle>
                    <EmailEditor
                        toValues={toValues}
                        setToValues={setToValues}
                        ccValues={ccValues}
                        setCcValues={setCcValues}
                        subject={subject}
                        setSubject={setSubject}

                        to={toValues.map(to => to.value)}
                        defaultToolbarExpanded={true}

                        handleSend={handleSend}
                        isSending={sendEmail.isPending}
                        onFeedbackIdChange={setInstantReplyFeedbackId}
                    />
                </DrawerHeader>
            </DrawerContent>

        </Drawer>
    )
}

export default ComposeButton