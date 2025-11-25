import { CheckCircle2 } from "lucide-react"

const benefits = [
  "Save hours every week with automated email management",
  "Never miss important messages with intelligent prioritization",
  "Respond faster with AI-generated contextual replies",
  "Stay organized with automatic categorization and tagging",
  "Reduce email overload with smart filtering and summaries",
  "Improve productivity with seamless calendar and task integration",
]

export function Benefits() {
  return (
    <section className="w-full py-24 bg-muted/30">
      <div className="mx-auto max-w-4xl px-6 md:px-8 lg:px-12">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            Why Choose LevraMail?
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Experience the benefits of intelligent email management
          </p>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2">
          {benefits.map((benefit, index) => (
            <div
              key={index}
              className="flex items-start gap-3 p-4 rounded-lg bg-card border hover:shadow-md transition-shadow"
            >
              <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
              <p className="text-base font-medium">{benefit}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

