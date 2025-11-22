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
import { Webhook } from "lucide-react"

import React from 'react'
import { useLocalStorage } from "usehooks-ts"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

// TODO: Create webhooks router in tRPC and uncomment the API calls below
// import { api } from "@/trpc/react"

type WebhookRecord = {
    id: number | string;
    resource: string;
    notificationUrl: string;
    active: boolean;
    failSince?: string;
    failDescription?: string;
}

const WebhookDebugger = () => {
    const [accountId] = useLocalStorage('accountId', '')
    // TODO: Uncomment when webhooks router is created
    // const { data, isLoading, refetch } = api.webhooks.getWebhooks.useQuery({
    //     accountId
    // }, { enabled: !!accountId })

    // const createWebhook = api.webhooks.createWebhook.useMutation()
    // const deleteWebhook = api.webhooks.deleteWebhook.useMutation()

    const [newWebhookUrl, setNewWebhookUrl] = React.useState('')
    const [isLoading] = React.useState(false)
    const [data] = React.useState<{ records?: WebhookRecord[] } | undefined>(undefined)

    const handleCreateWebhook = async () => {
        if (!accountId) {
            toast.error('Please select an account first')
            return
        }
        // TODO: Uncomment when webhooks router is created
        // toast.promise(
        //     createWebhook.mutateAsync({
        //         accountId,
        //         notificationUrl: newWebhookUrl
        //     }),
        //     {
        //         loading: 'Creating webhook...',
        //         success: () => {
        //             setNewWebhookUrl('')
        //             refetch()
        //             return 'Webhook created!'
        //         },
        //         error: err => {
        //             console.error(err)
        //             return 'Error creating webhook'
        //         }
        //     }
        // )
        toast.error('Webhooks API not yet implemented')
    }

    const handleDeleteWebhook = async (webhookId: string) => {
        if (!accountId) {
            toast.error('Please select an account first')
            return
        }
        // TODO: Uncomment when webhooks router is created
        // toast.promise(
        //     deleteWebhook.mutateAsync({
        //         accountId,
        //         webhookId
        //     }),
        //     {
        //         loading: 'Deleting webhook...',
        //         success: () => {
        //             refetch()
        //             return 'Webhook deleted!'
        //         },
        //         error: 'Error deleting webhook'
        //     }
        // )
        toast.error('Webhooks API not yet implemented')
    }

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button>
                    <Webhook className="size-4 mr-1" />
                    Debug Webhooks
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Webhook Debugger</DialogTitle>
                    <DialogDescription>
                        Manage webhooks for your email account. Webhooks API is not yet implemented.
                    </DialogDescription>
                </DialogHeader>
                <div className="mt-4">
                    {isLoading ? (
                        <div className="text-center py-4">Loading webhooks...</div>
                    ) : data?.records && data.records.length > 0 ? (
                        <div className="space-y-4">
                            {data.records.map((record: WebhookRecord) => (
                                <div key={record.id} className="p-4 rounded-md bg-slate-100 dark:bg-slate-800">
                                    <div className="mb-2">
                                        <span className="font-semibold">Resource:</span> {record.resource}
                                    </div>
                                    <div className="mb-2">
                                        <span className="font-semibold">URL:</span> {record.notificationUrl}
                                    </div>
                                    <div className="mb-2">
                                        <span className="font-semibold">Status:</span> {record.active ? (
                                            <span className="text-green-600">Active</span>
                                        ) : (
                                            <span className="text-red-600">Inactive</span>
                                        )}
                                    </div>
                                    {record.failSince && (
                                        <div className="mb-2">
                                            <span className="font-semibold">Failing since:</span> {record.failSince}
                                        </div>
                                    )}
                                    {record.failDescription && (
                                        <div className="mb-2">
                                            <span className="font-semibold">Fail reason:</span> {record.failDescription}
                                        </div>
                                    )}
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => handleDeleteWebhook(record.id.toString())}
                                    >
                                        Delete
                                    </Button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-4 text-muted-foreground">
                            No webhooks found
                        </div>
                    )}
                    <div className="mt-4">
                        <Input
                            type="text"
                            placeholder="Enter webhook URL"
                            value={newWebhookUrl}
                            onChange={(e) => setNewWebhookUrl(e.target.value)}
                        />
                        <Button
                            className="mt-2"
                            onClick={handleCreateWebhook}
                            disabled={!newWebhookUrl || !accountId}
                        >
                            Create Webhook
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

export default WebhookDebugger