import { api } from "@/trpc/react";
import { useLocalStorage } from "usehooks-ts"
import { type RouterOutputs } from "@/trpc/react"
import { atom } from "jotai"
import { useAtom } from "jotai"

export const threadIdAtom = atom<string | null>(null)

type Thread = RouterOutputs["account"]["getThreads"][number]

const useThreads = () => {
    const { data: accounts } = api.account.getAccounts.useQuery()
    const [accountId] = useLocalStorage('accountId', '')
    const [tab] = useLocalStorage('levramail-tab', 'inbox')
    const [done] = useLocalStorage('levramail-done', false)
    const [threadId, setThreadId] = useAtom(threadIdAtom)

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

    return {
        threads: threads ?? [],
        isFetching,
        refetch,
        accountId,
        account: accounts?.find(e => e.id === accountId),
        threadId,
        setThreadId
    }
}

export default useThreads