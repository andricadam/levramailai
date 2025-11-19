'use client'

import { SignIn, useAuth } from '@clerk/nextjs'
import { useSearchParams, useRouter } from 'next/navigation'
import React, { useEffect, Suspense } from 'react'

function SignInContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { isSignedIn, isLoaded } = useAuth()
  const redirectUrl = searchParams.get('redirect_url') || '/mail'
  
  // Redirect authenticated users away from sign-in page
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      // Use window.location for full page reload to ensure auth state syncs
      window.location.href = redirectUrl
    }
  }, [isLoaded, isSignedIn, redirectUrl])
  
  // Show loading state while checking auth
  if (!isLoaded) {
    return (
      <div className='flex justify-center items-center h-screen'>
        <div>Loading...</div>
      </div>
    )
  }
  
  // Redirecting if signed in - show loading
  if (isSignedIn) {
    return (
      <div className='flex justify-center items-center h-screen'>
        <div>Redirecting...</div>
      </div>
    )
  }
  
  return (
    <div className='flex justify-center items-center h-screen'>
      <SignIn 
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        afterSignInUrl={redirectUrl}
        appearance={{
          elements: {
            formButtonPrimary: 'bg-black text-white',
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
      <SignInContent />
    </Suspense>
  )
}