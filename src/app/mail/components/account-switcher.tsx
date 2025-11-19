"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { api, type RouterOutputs } from "@/trpc/react"
import { useLocalStorage } from "usehooks-ts"
import { Plus, Trash2 } from "lucide-react"
import { getAurinkoAuthUrl } from "@/lib/aurinko"
import { useAuth } from "@clerk/nextjs"
import { toast } from "sonner"

interface AccountSwitcherProps {
  isCollapsed: boolean
}

export function AccountSwitcher({
  isCollapsed
}: AccountSwitcherProps) {
  const { isSignedIn, isLoaded, userId } = useAuth()
  const shouldFetch = isLoaded && !!isSignedIn
  const { data: accounts, isLoading, error } = api.account.getAccounts.useQuery(undefined, {
    enabled: shouldFetch,
    retry: false,
  })
  
  // Debug logging
  React.useEffect(() => {
    if (shouldFetch) {
      console.log('Account Switcher Debug:', {
        isLoaded,
        isSignedIn,
        userId,
        accountsCount: accounts?.length ?? 0,
        accounts: accounts,
        error: error?.message,
      })
    }
  }, [shouldFetch, isLoaded, isSignedIn, userId, accounts, error])
  const [accountId, setAccountId] = useLocalStorage('accountId', '')
  const utils = api.useUtils()
  const deleteAccount = api.account.deleteAccount.useMutation({
    onSuccess: async () => {
      toast.success("Account deleted successfully")
      await utils.account.getAccounts.invalidate()
      // If we deleted the current account, switch to the first remaining account
      const remainingAccounts = accounts?.filter(acc => acc.id !== accountId) || []
      if (remainingAccounts.length > 0) {
        setAccountId(remainingAccounts[0]!.id)
      } else {
        setAccountId('')
      }
    },
    onError: (error) => {
      toast.error(`Failed to delete account: ${error.message}`)
    }
  })

  React.useEffect(() => {
    if (accounts && accounts.length > 0) {
      // If current accountId doesn't exist in accounts, reset to first account
      const accountExists = accounts.some(acc => acc.id === accountId)
      if (!accountExists) {
        setAccountId(accounts[0]!.id)
        return
      }
      if (accountId) return
      setAccountId(accounts[0]!.id)
    } else if (accounts && accounts.length === 0) {
      console.log('Link an account to continue')
    }
  }, [accounts, accountId, setAccountId])

  // Show loading state
  if (isLoading || !isLoaded) {
    return (
      <div className="items-center gap-2 flex w-full">
        <div className={cn(
          "flex w-full flex-1 items-center gap-2 h-9 rounded-md border border-input bg-background px-3 py-2 text-sm",
          isCollapsed && "h-9 w-9 shrink-0 items-center justify-center p-0"
        )}>
          <span className={cn("text-muted-foreground", isCollapsed && "hidden")}>Loading...</span>
        </div>
      </div>
    )
  }

  // Show error state
  if (error) {
    console.error('Error fetching accounts:', error)
    const isDbError = error.message?.includes('Can\'t reach database server') || 
                        error.message?.includes('database server')
    
    if (isDbError) {
      return (
        <div className="items-center gap-2 flex w-full">
          <div className={cn(
            "flex w-full flex-1 items-center gap-2 h-9 rounded-md border border-yellow-500 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-700 dark:text-yellow-400",
            isCollapsed && "h-9 w-9 shrink-0 items-center justify-center p-0"
          )}>
            <span className={cn("text-xs", isCollapsed && "hidden")}>
              Database connection issue - Check terminal
            </span>
          </div>
        </div>
      )
    }
    
    return (
      <div className="items-center gap-2 flex w-full">
        <div className={cn(
          "flex w-full flex-1 items-center gap-2 h-9 rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive",
          isCollapsed && "h-9 w-9 shrink-0 items-center justify-center p-0"
        )}>
          <span className={cn("text-xs", isCollapsed && "hidden")}>Error loading accounts</span>
        </div>
      </div>
    )
  }

  // Show "Add account" if no accounts exist
  if (!accounts || accounts.length === 0) {
    return (
      <div className="items-center gap-2 flex w-full">
        <button
          onClick={async () => {
            try {
              const url = await getAurinkoAuthUrl('Google')
              // Parse the URL to show the returnUrl being sent
              const urlObj = new URL(url)
              const returnUrl = urlObj.searchParams.get('returnUrl')
              console.log('🔍 DEBUG: returnUrl being sent to Aurinko:')
              console.log('   ', returnUrl)
              console.log('📋 Make sure this EXACT URL is in your Aurinko dashboard!')
              window.location.href = url
            } catch (error) {
              console.error((error as Error).message)
              toast.error((error as Error).message)
            }
          }}
          className={cn(
            "flex w-full flex-1 items-center gap-2 h-9 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground",
            isCollapsed && "h-9 w-9 shrink-0 items-center justify-center p-0"
          )}
        >
          <Plus className="size-4" />
          <span className={cn(isCollapsed && "hidden")}>Add account</span>
        </button>
      </div>
    )
  }

  return (
    <div className="items-center gap-2 flex w-full">
      <Select defaultValue={accountId} onValueChange={setAccountId}>
        <SelectTrigger
          className={cn(
            "flex w-full flex-1 items-center gap-2 [&>span]:line-clamp-1 [&>span]:flex [&>span]:w-full [&>span]:items-center [&>span]:gap-1 [&>span]:truncate [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0",
            isCollapsed &&
            "flex h-9 w-9 shrink-0 items-center justify-center p-0 [&>span]:w-auto [&>svg]:hidden"
          )}
          aria-label="Select account"
        >
          <SelectValue placeholder="Select an account">
            <span className={cn({ "hidden": !isCollapsed })}>
              {
                accounts.find((account) => account.id === accountId)?.emailAddress[0]
              }
            </span>
            <span className={cn("ml-2", isCollapsed && "hidden")}>
              {
                accounts.find((account) => account.id === accountId)
                  ?.emailAddress
              }
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {accounts.map((account) => (
            <SelectItem key={account.id} value={account.id}>
              <div className="flex items-center justify-between w-full gap-3 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0 [&_svg]:text-foreground">
                <span>{account.emailAddress}</span>
                {accounts.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm(`Are you sure you want to delete ${account.emailAddress}? This will delete all emails, threads, and related data for this account.`)) {
                        deleteAccount.mutate({ accountId: account.id })
                      }
                    }}
                    className="ml-auto hover:text-destructive transition-colors"
                    disabled={deleteAccount.isPending}
                    title="Delete account"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            </SelectItem>
          ))}
          <div onClick={async (e) => {
            try {
              const url = await getAurinkoAuthUrl('Google')
              // Parse the URL to show the returnUrl being sent
              const urlObj = new URL(url)
              const returnUrl = urlObj.searchParams.get('returnUrl')
              console.log('🔍 DEBUG: returnUrl being sent to Aurinko:')
              console.log('   ', returnUrl)
              console.log('📋 Make sure this EXACT URL is in your Aurinko dashboard!')
              window.location.href = url
            } catch (error) {
              console.error((error as Error).message)
              toast.error((error as Error).message)
            }
          }} className="relative flex hover:bg-gray-50 w-full cursor-pointer items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50">
            <Plus className="size-4 mr-1" />
            Add account
          </div>
        </SelectContent>
      </Select>
    </div>
  )
}