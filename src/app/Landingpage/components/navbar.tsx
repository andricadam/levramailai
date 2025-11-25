"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useUser } from "@clerk/nextjs"

export function Navbar() {
  const { isSignedIn, isLoaded } = useUser()

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="w-full flex h-16 items-center justify-between px-6 md:px-8 lg:px-12">
        <Link href="/" className="flex items-center space-x-2">
          <span className="text-xl font-bold">LevraMail</span>
        </Link>
        
        <div className="flex items-center gap-4">
          {isLoaded && isSignedIn ? (
            <Button asChild>
              <Link href="/mail">Go to Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link href="/sign-in">Sign In</Link>
              </Button>
              <Button asChild>
                <Link href="/sign-up">Sign Up</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}

