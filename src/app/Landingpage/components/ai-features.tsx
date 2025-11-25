import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Sparkles, Zap, Brain, MessageSquare, FileText, Clock } from "lucide-react"

const features = [
  {
    icon: Zap,
    title: "Instant Replies",
    description: "Generate smart, context-aware email responses in seconds. Never leave a message unanswered again.",
  },
  {
    icon: Brain,
    title: "AI Summarization",
    description: "Get concise summaries of long email threads. Understand conversations at a glance.",
  },
  {
    icon: MessageSquare,
    title: "Smart Drafts",
    description: "AI-powered email composition that suggests content based on your writing style and context.",
  },
  {
    icon: FileText,
    title: "Content Analysis",
    description: "Analyze email content for sentiment, priority, and action items automatically.",
  },
  {
    icon: Clock,
    title: "Smart Scheduling",
    description: "Intelligent calendar integration that suggests optimal meeting times based on your patterns.",
  },
  {
    icon: Sparkles,
    title: "Auto-Categorization",
    description: "Automatically organize emails into categories, folders, and priority levels.",
  },
]

export function AIFeatures() {
  return (
    <section className="w-full py-24">
      <div className="mx-auto max-w-6xl px-6 md:px-8 lg:px-12">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            Powerful AI Features
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Leverage cutting-edge AI to transform your email experience
          </p>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <Card key={feature.title} className="border hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}

