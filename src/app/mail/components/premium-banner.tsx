'use client'
import { motion } from 'framer-motion'
import React from 'react'
import StripeButton from './stripe-button'
import { api } from '@/trpc/react'
import { FREE_CREDITS_PER_DAY } from '@/app/constants'
import { getSubscriptionStatus } from '@/lib/stripe-actions'

const PremiumBanner = () => {
    const [isSubscribed, setIsSubscribed] = React.useState(false)
    React.useEffect(() => {
        (async () => {
            const subscriptionStatus = await getSubscriptionStatus()
            setIsSubscribed(subscriptionStatus)
        })()
    }, [])

    const { data: chatbotInteraction } = api.mail.getChatbotInteraction.useQuery()
    const remainingCredits = chatbotInteraction?.remainingCredits || 0

    if (isSubscribed) return (
        <motion.div layout className="bg-primary p-2.5 rounded-lg border overflow-hidden">
            <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                    <h2 className='text-primary-foreground text-sm font-semibold truncate'>Premium Plan</h2>
                    <p className='text-primary-foreground/80 text-xs mt-0.5 line-clamp-1'>Ask as many questions as you want</p>
                </div>
                <StripeButton size="sm" />
            </div>
        </motion.div>
    )

    return (
        <motion.div layout className="bg-primary p-2.5 rounded-lg border overflow-hidden">
            <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                    <h2 className='text-primary-foreground text-sm font-semibold'>Basic Plan</h2>
                    <p className='text-primary-foreground/80 text-xs whitespace-nowrap'>{remainingCredits} / {FREE_CREDITS_PER_DAY} remaining</p>
                </div>
                <p className='text-primary-foreground/80 text-xs line-clamp-1'>Upgrade to pro for unlimited questions</p>
                <StripeButton size="sm" />
            </div>
        </motion.div>
    )
}

export default PremiumBanner