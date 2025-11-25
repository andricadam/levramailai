import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Check } from "lucide-react"

const plans = [
  {
    name: "Starter",
    price: "$9",
    period: "/month",
    description: "Perfect for individuals getting started",
    features: [
      "Up to 1,000 emails/month",
      "AI instant replies",
      "Email summarization",
      "Basic categorization",
      "Email support",
    ],
    cta: "Get Started",
    popular: false,
  },
  {
    name: "Professional",
    price: "$29",
    period: "/month",
    description: "For professionals and small teams",
    features: [
      "Unlimited emails",
      "All AI features",
      "Advanced analytics",
      "Priority support",
      "Calendar integration",
      "Task management",
      "Custom templates",
    ],
    cta: "Get Started",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For large organizations",
    features: [
      "Everything in Professional",
      "Dedicated account manager",
      "Custom integrations",
      "Advanced security",
      "Team collaboration",
      "SLA guarantee",
      "Onboarding support",
    ],
    cta: "Contact Sales",
    popular: false,
  },
]

export function Pricing() {
  return (
    <section className="w-full py-24">
      <div className="mx-auto max-w-6xl px-6 md:px-8 lg:px-12">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            Choose Your Plan
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Flexible pricing options for every need
          </p>
        </div>
        
        <div className="grid gap-8 md:grid-cols-3">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={plan.popular ? "border-primary shadow-lg scale-105" : ""}
            >
              {plan.popular && (
                <div className="w-full bg-primary text-primary-foreground text-center py-2 text-sm font-medium rounded-t-lg">
                  Most Popular
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  {plan.period && <span className="text-muted-foreground">{plan.period}</span>}
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  variant={plan.popular ? "default" : "outline"}
                  asChild
                >
                  <Link href={plan.name === "Enterprise" ? "/sign-in" : "/sign-up"}>
                    {plan.cta}
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

