"use server"
import axios from 'axios'
import { OAuth2Client } from 'google-auth-library'

/**
 * Get account details from Google using access token
 */
export async function getGoogleAccountDetails(accessToken: string) {
  try {
    const response = await axios.get(
      'https://www.googleapis.com/gmail/v1/users/me/profile',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    return {
      email: response.data.emailAddress,
      name: response.data.messagesTotal ? 'Gmail User' : 'Gmail User', // Gmail API doesn't return name, we'll use email
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Error fetching Google account details:', error.response?.data)
      throw new Error(`Failed to fetch Google account details: ${error.response?.data?.error?.message || error.message}`)
    }
    throw error
  }
}

/**
 * Get account details from Microsoft using access token
 */
export async function getMicrosoftAccountDetails(accessToken: string) {
  try {
    const response = await axios.get(
      'https://graph.microsoft.com/v1.0/me',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    return {
      email: response.data.mail || response.data.userPrincipalName,
      name: response.data.displayName || response.data.mail || response.data.userPrincipalName,
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Error fetching Microsoft account details:', error.response?.data)
      throw new Error(`Failed to fetch Microsoft account details: ${error.response?.data?.error?.message || error.message}`)
    }
    throw error
  }
}

