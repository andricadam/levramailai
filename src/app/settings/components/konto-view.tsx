"use client"

import React from 'react'
import { useUser, useAuth } from '@clerk/nextjs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { MoreVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function KontoView() {
  const { user } = useUser()
  const { sessionId } = useAuth()

  return (
    <div className="space-y-6">
      <ProfileView user={user} />
      <SecurityView user={user} sessionId={sessionId} />
    </div>
  )
}

function ProfileView({ user }: { user: ReturnType<typeof useUser>['user'] }) {
  const primaryEmail = user?.emailAddresses?.find(
    email => email.id === user?.primaryEmailAddressId
  ) || user?.emailAddresses?.[0]

  const connectedAccounts = user?.externalAccounts || []

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6">Profile details</h2>

      {/* Profile Section */}
      <div className="space-y-4 mb-6">
        <div className="flex items-center justify-between">
          <Label>Profile</Label>
          <div className="flex items-center gap-2">
            <Button variant="link" className="h-auto p-0">
              Update profile
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>Edit</DropdownMenuItem>
                <DropdownMenuItem>View</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={user?.imageUrl} />
            <AvatarFallback className="bg-purple-500 text-white text-lg">
              {user?.firstName?.[0] || user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() || 'A'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="font-medium">
              {user?.fullName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'User'}
            </div>
          </div>
        </div>
      </div>

      <Separator className="my-6" />

      {/* Email Addresses Section */}
      <div className="space-y-4 mb-6">
        <div className="flex items-center justify-between">
          <Label>Email addresses</Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Manage emails</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {primaryEmail && (
          <div className="flex items-center gap-2">
            <span className="text-sm">{primaryEmail.emailAddress}</span>
            <Badge variant="secondary" className="text-xs">Primary</Badge>
          </div>
        )}
        <Button variant="link" className="h-auto p-0 text-sm">
          + Add email address
        </Button>
      </div>

      <Separator className="my-6" />

      {/* Connected Accounts Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Connected accounts</Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Manage accounts</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {connectedAccounts.length > 0 ? (
          <div className="space-y-2">
            {connectedAccounts.map((account) => (
              <div key={account.id} className="flex items-center gap-2 text-sm">
                <div className="h-5 w-5 rounded bg-muted flex items-center justify-center text-xs font-bold">
                  {account.provider === 'google' ? 'G' : account.provider?.[0]?.toUpperCase() || 'O'}
                </div>
                <span className="capitalize">{account.provider}</span>
                {account.emailAddress && (
                  <>
                    <span>•</span>
                    <span>{account.emailAddress}</span>
                  </>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No connected accounts</p>
        )}
        <Button variant="link" className="h-auto p-0 text-sm">
          + Connect account
        </Button>
      </div>
    </div>
  )
}

function SecurityView({ user, sessionId }: { user: ReturnType<typeof useUser>['user'], sessionId: string | null | undefined }) {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-6">Security</h2>

      {/* Password Section */}
      <div className="space-y-4 mb-6">
        <div className="flex items-center justify-between">
          <Label>Password</Label>
          <Button variant="link" className="h-auto p-0">
            Update password
          </Button>
        </div>
        <Input
          type="password"
          value="••••••••••"
          readOnly
          className="font-mono"
        />
      </div>

      <Separator className="my-6" />

      {/* Active Devices Section */}
      <div className="space-y-4 mb-6">
        <Label>Active devices</Label>
        <div className="space-y-4">
          <div className="flex items-start gap-4 p-4 border rounded-lg">
            <div className="h-10 w-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
              <div className="h-6 w-6 bg-foreground rounded-sm" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium">Macintosh</span>
                <Badge variant="secondary" className="text-xs">This device</Badge>
              </div>
              <div className="text-sm text-muted-foreground space-y-0.5">
                <div>Chrome 142.0.0.0</div>
                <div>213.55.223.86 (Genève, CH)</div>
                <div>Today at 9:48 AM</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Separator className="my-6" />

      {/* Delete Account Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Delete account</Label>
          <Button variant="link" className="h-auto p-0 text-destructive hover:text-destructive">
            Delete account
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Permanently delete your account and all associated data.
        </p>
      </div>
    </div>
  )
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("text-sm font-medium", className)}>
      {children}
    </label>
  )
}

