import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"

export function CTA() {
  return (
    <section className="w-full py-24">
      <div className="mx-auto max-w-4xl px-6 md:px-8 lg:px-12">
        <div className="rounded-lg border bg-card p-12 text-center shadow-lg">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            Ready to Transform Your Email?
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Join thousands of users who are already experiencing the future of email management.
            Start your free trial today.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/sign-up">
                Start Free Trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/sign-in">Sign In</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}

