import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"

export function Header() {
  return (
    <section className="w-full py-24 md:py-32">
      <div className="mx-auto max-w-4xl text-center px-6 md:px-8 lg:px-12">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
          Your AI-Powered
          <br />
          <span className="text-primary">Email Assistant</span>
        </h1>
        <p className="mt-6 text-lg text-muted-foreground sm:text-xl md:text-2xl">
          Streamline your email workflow with intelligent automation, 
          instant replies, and smart organization. Experience the future of email management.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button size="lg" asChild>
            <Link href="/sign-up">
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/sign-in">Sign In</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

