import { api } from '@/trpc/react'
import { getQueryKey } from '@trpc/react-query'
import React from 'react'
import { useLocalStorage } from 'usehooks-ts'
import { useAuth } from '@clerk/nextjs'

const useThreads = () => {
    const { isSignedIn, isLoaded } = useAuth()
    const shouldFetch = isLoaded && !!isSignedIn
    const { data: accounts } = api.account.getAccounts.useQuery(undefined, {
        enabled: shouldFetch,
        retry: false,
    })
    const [accountId] = useLocalStorage('accountId', '')
    const [tab] = useLocalStorage('levramail-tab', 'inbox')
    const [done] = useLocalStorage('levramail-done', false)
    const queryKey = getQueryKey(api.account.getThreads, { accountId, tab, done }, 'query')
    const { data: threads, isFetching, refetch } = api.account.getThreads.useQuery({
        accountId,
        done,
        tab
    }, { enabled: !!accountId && !!tab, placeholderData: (e) => e, refetchInterval: 1000 * 5 })

    return {
        threads,
        isFetching,
        account: accounts?.find((account) => account.id === accountId),
        refetch,
        accounts,
        queryKey,
        accountId
    }
}

export default useThreads