'use client'
import React from 'react'
import { Nav } from './nav'
import LabelsSection from './labels-section'

import {
    File,
    Inbox,
    Send,
    Ban,
    Trash2,
} from "lucide-react"
import { useLocalStorage } from 'usehooks-ts'
import { api } from '@/trpc/react'

type Props = { isCollapsed: boolean }

const SideBar = ({ isCollapsed = false }: Props) => {
    const [mounted, setMounted] = React.useState(false)
    const [tab] = useLocalStorage("levramail-tab", "inbox")
    const [accountId] = useLocalStorage("accountId", "")

    React.useEffect(() => {
        setMounted(true)
    }, [])

    const refetchInterval = 5000
    const { data: inboxThreads } = api.mail.getNumThreads.useQuery({
        accountId,
        tab: "inbox"
    }, { enabled: !!accountId && !!tab, refetchInterval })

    const { data: draftsThreads } = api.mail.getNumThreads.useQuery({
        accountId,
        tab: "drafts"
    }, { enabled: !!accountId && !!tab, refetchInterval })

    const { data: sentThreads } = api.mail.getNumThreads.useQuery({
        accountId,
        tab: "sent"
    }, { enabled: !!accountId && !!tab, refetchInterval })

    const { data: spamThreads } = api.mail.getNumThreads.useQuery({
        accountId,
        tab: "spam"
    }, { enabled: !!accountId && !!tab, refetchInterval })

    const { data: junkThreads } = api.mail.getNumThreads.useQuery({
        accountId,
        tab: "junk"
    }, { enabled: !!accountId && !!tab, refetchInterval })

    // Use default "inbox" on server to match initial client render
    const currentTab = mounted ? tab : "inbox"

    return (
        <div className="py-2 w-full space-y-6">
            <Nav
                isCollapsed={isCollapsed}
                links={[
                    {
                        title: "Inbox",
                        label: inboxThreads?.toString() || "0",
                        icon: Inbox,
                        variant: currentTab === "inbox" ? "default" : "ghost",
                    },
                    {
                        title: "Drafts",
                        label: draftsThreads?.toString() || "0",
                        icon: File,
                        variant: currentTab === "drafts" ? "default" : "ghost",
                    },
                    {
                        title: "Sent",
                        label: sentThreads?.toString() || "0",
                        icon: Send,
                        variant: currentTab === "sent" ? "default" : "ghost",
                    },
                    {
                        title: "Spam",
                        label: spamThreads?.toString() || "0",
                        icon: Ban,
                        variant: currentTab === "spam" ? "default" : "ghost",
                    },
                    {
                        title: "Junk",
                        label: junkThreads?.toString() || "0",
                        icon: Trash2,
                        variant: currentTab === "junk" ? "default" : "ghost",
                    },
                ]}
            />
            <LabelsSection isCollapsed={isCollapsed} />
        </div>
    )
}

export default SideBar
export { SideBar as Sidebar }
