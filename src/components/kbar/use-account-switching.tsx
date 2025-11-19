import { api } from '@/trpc/react'
import { useRegisterActions } from 'kbar'
import React from 'react'
import { useLocalStorage } from 'usehooks-ts'
import { useAuth } from '@clerk/nextjs'
import { usePathname } from 'next/navigation'

const useAccountSwitching = () => {
    const { isSignedIn, isLoaded } = useAuth()
    const pathname = usePathname()
    const isPublicRoute = pathname?.startsWith('/sign-in') || pathname?.startsWith('/sign-up')
    const shouldFetch = !isPublicRoute && isLoaded && !!isSignedIn
    
    const { data: accounts } = api.account.getAccounts.useQuery(undefined, {
        enabled: shouldFetch,
        retry: false,
    })

    // Create some fake data for demonstration purposes
    const mainAction = [{
        id: "accountsAction",
        name: "Switch Account",
        shortcut: ['e', 's'],
        section: "Accounts",
    }]
    const [_, setAccountId] = useLocalStorage('accountId', '')

    React.useEffect(() => {
        if (!shouldFetch || !accounts) return
        
        const handler = (event: KeyboardEvent) => {
            if (event.metaKey && /^[1-9]$/.test(event.key)) {
                event.preventDefault();
                const index = parseInt(event.key) - 1; // Convert key to index (0-based)
                if (accounts && accounts.length > index) {
                    setAccountId(accounts[index]!.id); // Switch to the corresponding account
                }
            }
        };

        window.addEventListener('keydown', handler);
        return () => {
            window.removeEventListener('keydown', handler);
        };
    }, [accounts, setAccountId, shouldFetch]);

    useRegisterActions(mainAction.concat((shouldFetch && accounts ? accounts.map((account, index) => {
        return {
            id: account.id,
            name: account.name,
            parent: 'accountsAction',
            perform: () => {
                console.log('perform', account.id)
                setAccountId(account.id)
            },
            keywords: [
                account.name,
                account.emailAddress,
            ].filter(Boolean) as string[],
            shortcut: [],
            section: "Accounts",
            subtitle: account.emailAddress,
            priority: 1000
        }
    }) : [])), [accounts, shouldFetch])

}

export default useAccountSwitching