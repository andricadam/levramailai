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
    const returnUrl = `${baseUrl}/api/auth/callback`

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
    
    // Debug logging (remove in production)
    console.log('Aurinko Auth URL generated:', {
        clientIdLength: clientId.length,
        clientIdPrefix: clientId.substring(0, 10) + '...', // Only log first 10 chars for security
        returnUrl,
        serviceType,
        scopes,
        fullUrl: authUrl, // Log full URL for debugging
    })

    return authUrl
}

export const exchangeCodeForAccessToken = async (code: string) => {
    try {
        const response = await axios.post(`https://api.aurinko.io/v1/auth/token/${code}`, {
            auth: {
                username: process.env.AURINKO_CLIENT_ID as string,
                password: process.env.AURINKO_CLIENT_SECRET as string,
            }
        })
        return response.data as {
            accountId: number,
            accessToken: string,
            userId: string,
            userSession: string,
        }
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error(error.response?.data)
        }
        console.error(error)
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