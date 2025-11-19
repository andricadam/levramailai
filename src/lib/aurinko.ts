"use server"
import axios from "axios"

import { auth } from "@clerk/nextjs/server"
import { headers } from "next/headers"
import { env } from "@/env"

export const getAurinkoAuthUrl = async (serviceType: 'Google' | 'Office365') => {
    const { userId } = await auth()
    if (!userId) throw new Error("Unauthorized")

    const clientId = env.AURINKO_CLIENT_ID
    
    // Validate clientId
    if (!clientId || clientId.trim() === '') {
        throw new Error("AURINKO_CLIENT_ID is not set or is empty")
    }

    // Get the base URL from headers
    const headersList = await headers()
    const host = headersList.get('host')
    const protocol = headersList.get('x-forwarded-proto') || 'http'
    const baseUrl = `${protocol}://${host}`
    // Ensure no trailing slash and exact path
    const returnUrl = `${baseUrl}/api/aurinko/callback`.replace(/\/+$/, '')

    // Set scopes - Aurinko uses its own scope identifiers (space-separated)
    // Valid scopes include: Mail.Read, Mail.ReadWrite, Mail.Send, Mail.Drafts, Mail.All
    // Both Google and Office365 use the same scope names in Aurinko
    const scopes = 'Mail.Read Mail.ReadWrite Mail.Send Mail.Drafts Mail.All'

    const params = new URLSearchParams({
        clientId,
        serviceType,
        scopes,
        responseType: 'code',
        returnUrl,
    })

    const authUrl = `https://api.aurinko.io/v1/auth/authorize?${params.toString()}`
    
    // Debug logging - IMPORTANT: The returnUrl below must be added to your Aurinko app settings!
    console.log('\n' + '='.repeat(60))
    console.log('🔴 AURINKO CALLBACK URL CONFIGURATION REQUIRED')
    console.log('='.repeat(60))
    console.log('⚠️  You MUST add this EXACT URL to your Aurinko app settings:')
    console.log('')
    console.log(`   ${returnUrl}`)
    console.log('')
    console.log('📋 Steps to fix:')
    console.log('   1. Go to https://developer.aurinko.io/ (or your Aurinko dashboard)')
    console.log('   2. Find your app with Client ID:', clientId.substring(0, 10) + '...')
    console.log('   3. Go to OAuth/Callback URL settings')
    console.log('   4. Add the URL above EXACTLY as shown (no trailing slash)')
    console.log('   5. Save the settings')
    console.log('='.repeat(60) + '\n')
    
    console.log('Aurinko Auth URL details:', {
        returnUrl,
        host,
        protocol,
        serviceType,
    })

    return authUrl
}

export const exchangeCodeForAccessToken = async (code: string) => {
    try {
        const clientId = env.AURINKO_CLIENT_ID
        const clientSecret = env.AURINKO_CLIENT_SECRET

        if (!clientId || !clientSecret) {
            throw new Error('AURINKO_CLIENT_ID or AURINKO_CLIENT_SECRET is not configured')
        }

        // Aurinko returns a JWT as the code parameter - use it directly in the URL path
        const response = await axios.post(
            `https://api.aurinko.io/v1/auth/token/${code}`,
            {},
            {
                auth: {
                    username: clientId,
                    password: clientSecret,
                }
            }
        )
        return response.data as {
            accountId: number,
            accessToken: string,
            userId: string,
            userSession: string,
        }
    } catch (error) {
        if (axios.isAxiosError(error)) {
            const errorData = error.response?.data
            const errorMessage = errorData?.message || error.message || 'Unknown error'
            const statusCode = error.response?.status
            console.error('=== TOKEN EXCHANGE ERROR ===')
            console.error('Status:', statusCode)
            console.error('Message:', errorMessage)
            console.error('Full error data:', JSON.stringify(errorData, null, 2))
            console.error('Response headers:', error.response?.headers)
            throw new Error(`Failed to exchange code for access token: ${errorMessage}`)
        }
        console.error('Unexpected error exchanging code:', error)
        throw error
    }
}

export const getAccountDetails = async (accessToken: string) => {
    try {
        const response = await axios.get('https://api.aurinko.io/v1/account', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        })
        return response.data as {
            email: string,
            name: string,
        }
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error('Error fetching account details:', error.response?.data);
        } else {
            console.error('Unexpected error fetching account details:', error);
        }
        throw error;
    }
}