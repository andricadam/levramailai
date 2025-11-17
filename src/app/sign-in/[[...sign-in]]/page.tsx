import { SignIn } from '@clerk/nextjs'
import React from 'react'

export default function Page() {
  return (
    <div className='flex justify-center items-center h-screen'>
      <SignIn 
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        appearance={{
          elements: {
            formButtonPrimary: 'bg-black text-white',
          },
        }}
      />
    </div>
  )
}