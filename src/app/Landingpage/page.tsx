import { Navbar } from "./components/navbar"
import { Header } from "./components/header"
import { CompaniesCarousel } from "./components/companies-carousel"
import { AIFeatures } from "./components/ai-features"
import { Benefits } from "./components/benefits"
import { Pricing } from "./components/pricing"
import { CTA } from "./components/cta"
import { Footer } from "./components/footer"

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Header />
        <CompaniesCarousel />
        <div id="features">
          <AIFeatures />
        </div>
        <Benefits />
        <div id="pricing">
          <Pricing />
        </div>
        <CTA />
      </main>
      <Footer />
    </div>
  )
}

