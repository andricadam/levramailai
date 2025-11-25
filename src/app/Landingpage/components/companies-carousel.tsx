"use client"

import { useEffect, useRef } from "react"
import Image from "next/image"

const providers = [
  { name: "Azure", image: "/providers/Azure.png" },
  { name: "OpenAI", image: "/providers/OpenAI.webp" },
  { name: "Gmail", image: "/providers/gmail.png" },
  { name: "Outlook", image: "/providers/outlook.svg" },
  { name: "Icloud Mail", image: "/providers/icloud mail.png" },
  { name: "Aurinko", image: "/providers/aurinko.webp" },
  { name: "Orama", image: "/providers/orama.jpeg" },
  { name: "Stripe", image: "/providers/stripe.png" },
  { name: "Clerk", image: "/providers/clerk.webp" },
]

export function CompaniesCarousel() {
  const carouselRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const carousel = carouselRef.current
    if (!carousel) return

    let animationId: number
    let position = 0
    const speed = 0.5 // pixels per frame
    const itemWidth = 200 + 32 // width + gap (w-[200px] + gap-8 = 32px)

    const animate = () => {
      position -= speed
      
      // Reset position when we've scrolled past one set of providers
      const totalWidth = providers.length * itemWidth
      
      if (Math.abs(position) >= totalWidth) {
        position = 0
      }
      
      carousel.style.transform = `translateX(${position}px)`
      animationId = requestAnimationFrame(animate)
    }

    animationId = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(animationId)
    }
  }, [])

  return (
    <section className="w-full py-12 border-y bg-muted/30">
      <div className="w-full">
        <p className="text-center text-sm text-muted-foreground mb-8 px-6 md:px-8 lg:px-12">
          Powered by industry-leading providers
        </p>
        <div className="relative overflow-hidden w-full">
          <div
            ref={carouselRef}
            className="flex gap-8"
            style={{ width: "fit-content" }}
          >
            {/* Render providers multiple times for seamless loop */}
            {[...providers, ...providers, ...providers].map((provider, index) => (
              <div
                key={`${provider.name}-${index}`}
                className="flex-shrink-0 w-[200px] h-20 flex items-center justify-center rounded-lg bg-card border shadow-sm p-4"
              >
                <Image
                  src={provider.image}
                  alt={provider.name}
                  width={160}
                  height={80}
                  className="object-contain max-w-full max-h-full"
                  unoptimized={provider.image.endsWith('.svg')}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

