import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
])

// Define API routes that should return JSON errors instead of HTML redirects
// (they handle authentication internally with proper error responses)
const isApiRoute = createRouteMatcher([
  '/api(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  // Allow API routes to be handled by their own error handling
  // (they should return JSON errors, not HTML redirects)
  if (isApiRoute(req)) {
    return NextResponse.next()
  }
  
  // Allow public routes (sign-in/sign-up)
  if (isPublicRoute(req)) {
    return NextResponse.next()
  }
  
  // Protect all other routes - check authentication
  const authResult = await auth()
  
  // If not authenticated, redirect to sign-in with redirect_url
  if (!authResult?.userId) {
    const signInUrl = new URL('/sign-in', req.url)
    const redirectUrl = new URL(req.url)
    
    // Clean up Clerk-specific params
    redirectUrl.searchParams.delete('_clerk_handshake')
    redirectUrl.searchParams.delete('__clerk_db_jwt')
    
    // Set redirect_url parameter
    signInUrl.searchParams.set('redirect_url', redirectUrl.pathname + redirectUrl.search)
    
    return NextResponse.redirect(signInUrl)
  }
  
  // User is authenticated, allow access
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