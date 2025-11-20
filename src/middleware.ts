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
  
  // Check authentication status
  const authResult = await auth()
  const isAuthenticated = !!authResult?.userId
  
  // Handle sign-in/sign-up routes - always allow access (Clerk handles redirects)
  if (isPublicRoute(req)) {
    // If user is authenticated, let Clerk's SignIn component handle the redirect
    // Don't redirect here to avoid conflicts with Clerk's internal redirect logic
    return NextResponse.next()
  }
  
  // Protect all other routes - check authentication
  // If not authenticated, redirect to sign-in with redirect_url
  if (!isAuthenticated) {
    // Check if this is an OAuth callback - if so, allow it through to let Clerk handle it
    const isOAuthCallback = req.nextUrl.searchParams.has('__clerk_db_jwt') || 
                            req.nextUrl.searchParams.has('_clerk_handshake')
    
    if (isOAuthCallback) {
      // Allow OAuth callback to proceed - Clerk will handle the session setup
      return NextResponse.next()
    }
    
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