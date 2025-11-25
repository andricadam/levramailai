'use client'

import { SignUp, useAuth } from '@clerk/nextjs'
import { useSearchParams } from 'next/navigation'
import React, { Suspense, useEffect, useRef } from 'react'

function SignUpContent() {
  const searchParams = useSearchParams()
  const { isSignedIn, isLoaded, userId } = useAuth()
  const redirectUrl = searchParams.get('redirect_url') || '/mail'
  const redirectAttempted = useRef(false)
  
  // Check if we're coming from an OAuth callback (has __clerk_db_jwt or similar params)
  const isOAuthCallback = typeof window !== 'undefined' && (
    window.location.search.includes('__clerk') || 
    window.location.search.includes('_clerk_handshake')
  )
  
  // If user is already signed in, redirect them immediately
  useEffect(() => {
    if (isLoaded && isSignedIn && userId && !isOAuthCallback) {
      // User is already signed in, redirect to mail
      window.location.href = redirectUrl
    }
  }, [isLoaded, isSignedIn, userId, redirectUrl, isOAuthCallback])
  
  // After successful sign-up (especially OAuth), wait for session cookie to sync, then redirect
  useEffect(() => {
    if (isLoaded && isSignedIn && userId && isOAuthCallback && !redirectAttempted.current) {
      redirectAttempted.current = true
      // Wait longer for OAuth session cookies to be set and recognized by server
      // OAuth callbacks need more time for cookie sync
      const delay = 3000
      const timer = setTimeout(() => {
        // Use full page reload to ensure all cookies are sent with the request
        window.location.href = redirectUrl
      }, delay)
      
      return () => clearTimeout(timer)
    }
  }, [isLoaded, isSignedIn, userId, redirectUrl, isOAuthCallback])
  
  // Show loading while Clerk initializes
  if (!isLoaded) {
    return (
      <div className='flex justify-center items-center h-screen'>
        <div>Loading...</div>
      </div>
    )
  }
  
  // If user is already signed in (and not from OAuth callback), show redirecting message
  if (isSignedIn && userId && !isOAuthCallback) {
    return (
      <div className='flex justify-center items-center h-screen'>
        <div className='text-center space-y-4 max-w-md p-6'>
          <div className='text-lg font-semibold mb-2'>Already signed in</div>
          <div className='text-sm text-gray-600 mb-4'>
            Redirecting to {redirectUrl}...
          </div>
          <div className='text-xs text-gray-500'>
            If you're not redirected, 
            <a href={redirectUrl} className='text-blue-600 hover:underline ml-1'>
              click here
            </a>
          </div>
        </div>
      </div>
    )
  }
  
  // If user just signed up (especially after OAuth), show redirecting message
  if (isSignedIn && userId && isOAuthCallback) {
    return (
      <div className='flex justify-center items-center h-screen'>
        <div className='text-center space-y-4 max-w-md p-6'>
          <div className='text-lg font-semibold mb-2'>Sign up successful!</div>
          <div className='text-sm text-gray-600 mb-4'>
            Redirecting to {redirectUrl}...
          </div>
          <div className='text-xs text-gray-500'>
            If you're not redirected, 
            <a href={redirectUrl} className='text-blue-600 hover:underline ml-1'>
              click here
            </a>
          </div>
        </div>
      </div>
    )
  }
  
  // Show sign-up form - Clerk will handle redirect after successful sign-up
  // Only use fallbackRedirectUrl to avoid conflicts
  return (
    <div className='flex justify-center items-center h-screen'>
      <SignUp 
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        fallbackRedirectUrl={redirectUrl}
        appearance={{
          elements: {
            formButtonPrimary: 'bg-black text-white hover:bg-gray-800',
          },
        }}
      />
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={
      <div className='flex justify-center items-center h-screen'>
        <div>Loading...</div>
      </div>
    }>
      <SignUpContent />
    </Suspense>
  )
}