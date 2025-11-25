"use client"

import React from 'react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

type PlanType = 'free' | 'pro' | 'enterprise'
type BillingPeriod = 'monthly' | 'yearly'

export function AbrechnungView() {
  const [billingPeriod, setBillingPeriod] = React.useState<BillingPeriod>('monthly')
  const [selectedPlan, setSelectedPlan] = React.useState<PlanType | null>(null)

  const plans = {
    free: {
      name: 'Free',
      subtitle: 'Get to know Levra',
      price: '0 CHF',
      priceYearly: '0 CHF',
      buttonText: 'Use Levra for free',
      features: [
        'Email management with multiple accounts',
        'Basic email search',
        'Calendar integration',
        'Basic AI chat (5 requests/day)',
        'Email threading and organization',
      ],
    },
    pro: {
      name: 'Pro',
      subtitle: 'Work and organize more effectively',
      price: '20 CHF / Month',
      priceYearly: '17 CHF / Month with annual billing',
      buttonText: 'Get Pro Plan',
      features: [
        'Everything from Free, plus:',
        'Unlimited AI chat requests',
        'AI email composition',
        'Advanced email analysis',
        'Advanced search with semantic search',
        'Priority support',
      ],
    },
    enterprise: {
      name: 'Enterprise',
      subtitle: 'Higher limits, team features',
      price: '35 CHF / Month per seat',
      priceYearly: '30 CHF / Month per seat with annual billing',
      buttonText: 'Get Enterprise Plan',
      features: [
        'Everything from Pro, plus:',
        'Team management and permissions',
        'Shared email accounts and calendars',
        'Advanced team analytics',
        'Dedicated account manager',
        'SSO and advanced security',
        'API access for integrations',
      ],
    },
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-2">Plans that grow with you</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Free Plan */}
        <PlanCard
          plan={plans.free}
          planType="free"
          billingPeriod={billingPeriod}
          isHighlighted={false}
          onSelect={() => setSelectedPlan('free')}
        />

        {/* Pro Plan */}
        <PlanCard
          plan={plans.pro}
          planType="pro"
          billingPeriod={billingPeriod}
          isHighlighted={true}
          onSelect={() => setSelectedPlan('pro')}
          showBillingToggle={true}
          onBillingToggle={(period) => setBillingPeriod(period)}
        />

        {/* Enterprise Plan */}
        <PlanCard
          plan={plans.enterprise}
          planType="enterprise"
          billingPeriod={billingPeriod}
          isHighlighted={false}
          onSelect={() => setSelectedPlan('enterprise')}
        />
      </div>
    </div>
  )
}

interface PlanCardProps {
  plan: {
    name: string
    subtitle: string
    price: string
    priceYearly: string
    buttonText: string
    features: string[]
  }
  planType: PlanType
  billingPeriod: BillingPeriod
  isHighlighted: boolean
  onSelect: () => void
  showBillingToggle?: boolean
  onBillingToggle?: (period: BillingPeriod) => void
}

function PlanCard({
  plan,
  planType,
  billingPeriod,
  isHighlighted,
  onSelect,
  showBillingToggle = false,
  onBillingToggle,
}: PlanCardProps) {
  const [localBillingPeriod, setLocalBillingPeriod] = React.useState<BillingPeriod>(billingPeriod)

  const handleBillingToggle = (checked: boolean) => {
    const newPeriod = checked ? 'yearly' : 'monthly'
    setLocalBillingPeriod(newPeriod)
    onBillingToggle?.(newPeriod)
  }

  const displayPrice = localBillingPeriod === 'yearly' ? plan.priceYearly : plan.price
  const showSavings = planType === 'pro' && localBillingPeriod === 'yearly'

  return (
    <div
      className={cn(
        "relative rounded-lg border p-6 flex flex-col",
        isHighlighted
          ? "bg-muted border-primary shadow-lg"
          : "bg-card border-border"
      )}
    >
      {/* Icon */}
      <div className="mb-4">
        <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
          <div className="h-8 w-8 bg-primary/20 rounded flex items-center justify-center">
            <div className="h-4 w-4 bg-primary rounded-sm" />
          </div>
        </div>
      </div>

      {/* Billing Toggle (only for Pro/Enterprise) */}
      {showBillingToggle && (
        <div className="mb-4 space-y-2">
          <div className="flex items-center justify-center gap-3">
            <span className={cn(
              "text-sm transition-colors",
              localBillingPeriod === 'monthly' ? "text-foreground font-medium" : "text-muted-foreground"
            )}>
              Monthly
            </span>
            <Switch
              checked={localBillingPeriod === 'yearly'}
              onCheckedChange={handleBillingToggle}
            />
            <span className={cn(
              "text-sm transition-colors",
              localBillingPeriod === 'yearly' ? "text-primary font-medium" : "text-muted-foreground"
            )}>
              Yearly
            </span>
          </div>
          {showSavings && (
            <div className="text-xs text-primary font-medium text-center">
              Save 17%
            </div>
          )}
        </div>
      )}

      {/* Title and Subtitle */}
      <div className="mb-4">
        <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
        <p className="text-sm text-muted-foreground">{plan.subtitle}</p>
      </div>

      {/* Price */}
      <div className="mb-6">
        <div className="text-2xl font-bold">{displayPrice}</div>
      </div>

      {/* CTA Button */}
      <Button
        onClick={onSelect}
        className={cn(
          "w-full mb-6",
          isHighlighted
            ? "bg-primary text-primary-foreground hover:bg-primary/90"
            : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
        )}
      >
        {plan.buttonText}
      </Button>

      {/* Features */}
      <div className="flex-1 space-y-3">
        {plan.features.map((feature, index) => (
          <div key={index} className="flex items-start gap-2">
            <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
            <span className="text-sm text-muted-foreground">{feature}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

