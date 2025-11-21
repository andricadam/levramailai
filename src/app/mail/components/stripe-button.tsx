'use client'
import { Button } from '@/components/ui/button'
import { createBillingPortalSession, createCheckoutSession, getSubscriptionStatus } from '@/lib/stripe-actions'
import React from 'react'

const StripeButton = ({ size = 'lg' }: { size?: 'sm' | 'default' | 'lg' }) => {
    const [isSubscribed, setIsSubscribed] = React.useState(false)
    React.useEffect(() => {
        (async () => {
            const isSubscribed = await getSubscriptionStatus()
            setIsSubscribed(isSubscribed)
        })()
    }, [])

    const handleClick = async () => {
        if (!isSubscribed) {
            await createCheckoutSession()
        } else {
            await createBillingPortalSession()
        }
    }
    return (
        <Button variant={'outline'} size={size} onClick={handleClick}>{isSubscribed ? 'Manage Subscription' : 'Upgrade Plan'}</Button>
    )
}

export default StripeButton