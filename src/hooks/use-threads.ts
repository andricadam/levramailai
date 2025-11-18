import { api } from "@/trpc/react";
import React from "react";
import { useLocalStorage } from "usehooks-ts"
import { type RouterOutputs } from "@/trpc/react"

type Thread = RouterOutputs["account"]["getThreads"][number]

// Dummy data for development
const getDummyThreads = (): Thread[] => {
    const now = new Date()
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const twoDaysAgo = new Date(now)
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
    const lastWeek = new Date(now)
    lastWeek.setDate(lastWeek.getDate() - 7)

    return [
        {
            id: '1',
            subject: 'Welcome to LevraMail AI',
            lastMessageDate: now,
            emails: [{
                id: '1',
                from: { 
                    name: 'John Doe', 
                    id: 'addr1',
                    accountId: 'acc1',
                    address: 'john@example.com',
                    raw: null
                },
                subject: 'Welcome to LevraMail AI',
                body: 'This is a sample email body',
                bodySnippet: 'This is a sample email body snippet...',
                sentAt: now,
                emailLabel: 'inbox' as const,
                sysLabels: []
            }]
        },
        {
            id: '2',
            subject: 'Project Update',
            lastMessageDate: yesterday,
            emails: [{
                id: '2',
                from: { 
                    name: 'Jane Smith', 
                    id: 'addr2',
                    accountId: 'acc1',
                    address: 'jane@example.com',
                    raw: null
                },
                subject: 'Project Update',
                body: 'Here is the latest update on the project',
                bodySnippet: 'Here is the latest update on the project...',
                sentAt: yesterday,
                emailLabel: 'inbox' as const,
                sysLabels: []
            }]
        },
        {
            id: '3',
            subject: 'Meeting Reminder',
            lastMessageDate: twoDaysAgo,
            emails: [{
                id: '3',
                from: { 
                    name: 'Bob Johnson', 
                    id: 'addr3',
                    accountId: 'acc1',
                    address: 'bob@example.com',
                    raw: null
                },
                subject: 'Meeting Reminder',
                body: 'Don\'t forget about our meeting tomorrow',
                bodySnippet: 'Don\'t forget about our meeting tomorrow...',
                sentAt: twoDaysAgo,
                emailLabel: 'inbox' as const,
                sysLabels: []
            }]
        },
        {
            id: '4',
            subject: 'Weekly Report',
            lastMessageDate: lastWeek,
            emails: [{
                id: '4',
                from: { 
                    name: 'Alice Williams', 
                    id: 'addr4',
                    accountId: 'acc1',
                    address: 'alice@example.com',
                    raw: null
                },
                subject: 'Weekly Report',
                body: 'Please find attached the weekly report',
                bodySnippet: 'Please find attached the weekly report...',
                sentAt: lastWeek,
                emailLabel: 'inbox' as const,
                sysLabels: []
            }]
        },
        {
            id: '5',
            subject: 'Team Lunch',
            lastMessageDate: now,
            emails: [{
                id: '5',
                from: { 
                    name: 'Charlie Brown', 
                    id: 'addr5',
                    accountId: 'acc1',
                    address: 'charlie@example.com',
                    raw: null
                },
                subject: 'Team Lunch',
                body: 'Let\'s have lunch together this Friday',
                bodySnippet: 'Let\'s have lunch together this Friday...',
                sentAt: now,
                emailLabel: 'inbox' as const,
                sysLabels: []
            }]
        }
    ] as unknown as Thread[]
}

const useThreads = () => {
    const { data: accounts } = api.account.getAccounts.useQuery()
    const [accountId] = useLocalStorage('accountId', '')
    const [tab] = useLocalStorage('levramail-tab', 'inbox')
    const [done] = useLocalStorage('levramail-done', false)

    const { data: threads, isFetching, refetch } = api.account.getThreads.useQuery({
        accountId,
        tab,
        done
    }, {
        enabled: !!accountId && !!tab,
        placeholderData: (previousData) => previousData,
        staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh for 5 minutes
        refetchOnWindowFocus: false, // Don't refetch when window regains focus
        refetchOnMount: false, // Don't refetch on component mount if data exists
        refetchOnReconnect: false, // Don't refetch on network reconnect
    })

    // Use dummy data in development when no threads are found or query is disabled
    const displayThreads = React.useMemo(() => {
        if (threads && threads.length > 0) {
            return threads
        }
        // Return dummy data for development when no real data is available
        return getDummyThreads()
    }, [threads])

    return {
        threads: displayThreads,
        isFetching,
        refetch,
        accountId,
        account: accounts?.find(e => e.id === accountId)
    }
}

export default useThreads