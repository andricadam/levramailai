'use client'
import React from 'react'
import { Button } from './button'
import { getAurinkoAuthUrl } from '@/lib/aurinko'

const LinkAccountButton = () => {
    return (
        <Button onClick={async() => {
            try {
                const authUrl = await getAurinkoAuthUrl('Google')
                window.location.href = authUrl
            } catch (error) {
                console.error('Error getting auth URL:', error)
            }
        }}>
            Link Account
        </Button>
    )
}

export default LinkAccountButton