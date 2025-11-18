import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/clerk/webhook(.*)',
  '/api/initial-sync(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  // Protect all routes except public ones
  if (!isPublicRoute(req)) {
    const authResult = await auth()
    
    // Explicitly check for userId and redirect if not authenticated
    if (!authResult.userId) {
      const signInUrl = new URL('/sign-in', req.url)
      // Preserve the original URL but clean it up
      const redirectUrl = new URL(req.url)
      redirectUrl.searchParams.delete('_clerk_handshake')
      signInUrl.searchParams.set('redirect_url', redirectUrl.pathname + redirectUrl.search)
      return NextResponse.redirect(signInUrl)
    }
  }
  
  return NextResponse.next()
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}