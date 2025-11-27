'use client'
import React, { useState, useCallback } from 'react'
import { api } from '@/trpc/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Globe, 
  Calendar, 
  FolderOpen, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  RefreshCw,
  Settings as SettingsIcon,
  Trash2,
  Upload,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useLocalStorage } from 'usehooks-ts'

// Integration definitions
const INTEGRATIONS = [
  {
    id: 'google_drive',
    name: 'Google Drive',
    icon: FolderOpen,
    description: 'Access your Google Drive documents and files in AI search',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    beta: false,
  },
  {
    id: 'google_calendar',
    name: 'Google Calendar',
    icon: Calendar,
    description: 'Access your calendar events and meetings in AI search',
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/20',
    beta: true,
  },
  {
    id: 'sharepoint',
    name: 'SharePoint',
    icon: Globe,
    description: 'Access your SharePoint documents and sites in AI search',
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/20',
    beta: true,
  },
] as const

type Integration = typeof INTEGRATIONS[number]

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export function KnowledgebaseView() {
  const [accountId] = useLocalStorage('accountId', '')
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)

  const { data: connections, isLoading, refetch } = api.integrations.getConnections.useQuery()
  const disconnectMutation = api.integrations.disconnect.useMutation()
  const syncMutation = api.integrations.sync.useMutation()
  const updateSettingsMutation = api.integrations.updateSettings.useMutation()

  const handleConnect = (integrationId: string) => {
    // Build connect URL
    let connectUrl = `/api/integrations/${integrationId}/connect`
    if (accountId) {
      connectUrl += `?accountId=${accountId}`
    }
    window.location.href = connectUrl
  }

  const handleDisconnect = async (connectionId: string) => {
    try {
      await disconnectMutation.mutateAsync({ connectionId })
      toast.success('Integration disconnected successfully')
      refetch()
    } catch (error) {
      toast.error('Failed to disconnect integration')
      console.error('Disconnect error:', error)
    }
  }

  const handleSync = async (connectionId: string) => {
    try {
      await syncMutation.mutateAsync({ connectionId })
      toast.success('Sync started. This may take a few minutes.')
      refetch()
    } catch (error) {
      toast.error('Failed to start sync')
      console.error('Sync error:', error)
    }
  }

  const handleToggleEnabled = async (connectionId: string, enabled: boolean) => {
    try {
      await updateSettingsMutation.mutateAsync({
        connectionId,
        enabled,
      })
      toast.success(enabled ? 'Integration enabled' : 'Integration disabled')
      refetch()
    } catch (error) {
      toast.error('Failed to update settings')
      console.error('Update settings error:', error)
    }
  }

  const handleFileUpload = useCallback(async (files: FileList) => {
    if (!accountId) {
      toast.error('Please select an account first')
      return
    }

    setUploading(true)
    const uploadPromises = Array.from(files).map(async (file) => {
      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`File "${file.name}" is too large. Maximum size is 10MB.`)
        return
      }

      // Validate file type
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'text/markdown',
        'image/png',
        'image/jpeg',
        'image/jpg',
      ]

      if (!allowedTypes.includes(file.type)) {
        toast.error(`File type "${file.type}" is not supported`)
        return
      }

      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('accountId', accountId)
        formData.append('addToKnowledgeBase', 'true') // Always true for knowledge base uploads

        const response = await fetch('/api/chat/upload', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Upload failed')
        }

        toast.success(`File "${file.name}" added to knowledge base`)
      } catch (error) {
        console.error('Upload error:', error)
        toast.error(
          `Failed to upload "${file.name}": ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    })

    await Promise.all(uploadPromises)
    setUploading(false)
  }, [accountId])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileUpload(files)
    }
  }, [handleFileUpload])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileUpload(files)
    }
  }, [handleFileUpload])

  const getConnection = (appType: string) => {
    return connections?.find(c => c.appType === appType)
  }

  const formatDate = (date: Date | null) => {
    if (!date) return 'Never'
    return new Date(date).toLocaleString()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold mb-2">Knowledgebase</h2>
        <p className="text-muted-foreground">
          Connect your apps and upload documents to make their content searchable in AI. Workspace owners can link their team's knowledge across all apps they use for work.
        </p>
        <a 
          href="#" 
          className="text-sm text-primary hover:underline mt-2 inline-block"
        >
          Learn more
        </a>
      </div>

      {/* Drag and Drop Area */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Documents</CardTitle>
          <CardDescription>
            Drag and drop files here to add them to your knowledge base. Supported formats: PDF, DOC, DOCX, TXT, MD, PNG, JPG, JPEG (max 10MB per file).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
              isDragging
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50",
              uploading && "opacity-50 pointer-events-none"
            )}
          >
            <input
              type="file"
              multiple
              onChange={handleFileInput}
              className="hidden"
              id="knowledgebase-upload"
              accept=".pdf,.doc,.docx,.txt,.md,.png,.jpg,.jpeg"
              disabled={uploading || !accountId}
            />
            <label
              htmlFor="knowledgebase-upload"
              className={cn(
                "flex flex-col items-center gap-4 cursor-pointer",
                (!accountId || uploading) && "cursor-not-allowed opacity-50"
              )}
            >
              {uploading ? (
                <>
                  <Loader2 className="size-12 text-muted-foreground animate-spin" />
                  <div>
                    <p className="text-lg font-medium">Uploading files...</p>
                    <p className="text-sm text-muted-foreground">Please wait</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-full bg-primary/10 p-4">
                    <Upload className="size-8 text-primary" />
                  </div>
                  <div>
                    <p className="text-lg font-medium">
                      {isDragging ? 'Drop files here' : 'Drag and drop files here'}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      or click to browse
                    </p>
                  </div>
                  {!accountId && (
                    <p className="text-sm text-destructive">
                      Please select an account first
                    </p>
                  )}
                </>
              )}
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Integrations Grid */}
      <div>
        <h3 className="text-xl font-semibold mb-4">App Integrations</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {INTEGRATIONS.map((integration) => {
            const connection = getConnection(integration.id)
            const Icon = integration.icon
            const isConnected = !!connection
            const isSyncing = connection?.syncStatus === 'syncing'
            const hasError = connection?.syncStatus === 'error'

            return (
              <Card 
                key={integration.id}
                className={cn(
                  "relative overflow-hidden transition-all hover:shadow-md",
                  isConnected && integration.borderColor
                )}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2 rounded-lg",
                        integration.bgColor
                      )}>
                        <Icon className={cn("size-6", integration.color)} />
                      </div>
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          {integration.name}
                          {integration.beta && (
                            <Badge variant="secondary" className="text-xs">
                              Beta
                            </Badge>
                          )}
                        </CardTitle>
                      </div>
                    </div>
                    {isConnected && (
                      <CheckCircle2 className="size-5 text-green-500" />
                    )}
                  </div>
                  <CardDescription className="mt-2">
                    {integration.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  {isConnected ? (
                    <>
                      {/* Connection Status */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Status</span>
                          <div className="flex items-center gap-2">
                            {isSyncing ? (
                              <>
                                <Loader2 className="size-4 animate-spin" />
                                <span>Syncing...</span>
                              </>
                            ) : hasError ? (
                              <>
                                <XCircle className="size-4 text-red-500" />
                                <span className="text-red-500">Error</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="size-4 text-green-500" />
                                <span className="text-green-500">Connected</span>
                              </>
                            )}
                          </div>
                        </div>
                        
                        {connection.lastSyncedAt && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Last synced</span>
                            <span>{formatDate(connection.lastSyncedAt)}</span>
                          </div>
                        )}

                        {connection.syncError && (
                          <div className="text-sm text-red-500 bg-red-500/10 p-2 rounded">
                            {connection.syncError}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSync(connection.id)}
                          disabled={isSyncing || syncMutation.isPending}
                          className="w-full"
                        >
                          {isSyncing || syncMutation.isPending ? (
                            <>
                              <Loader2 className="size-4 mr-2 animate-spin" />
                              Syncing...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="size-4 mr-2" />
                              Sync now
                            </>
                          )}
                        </Button>

                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={() => setSelectedConnection(connection.id)}
                            >
                              <SettingsIcon className="size-4 mr-2" />
                              Settings
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>{integration.name} Settings</DialogTitle>
                              <DialogDescription>
                                Manage your {integration.name} integration settings
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                  <Label htmlFor="enabled">Enable integration</Label>
                                  <p className="text-sm text-muted-foreground">
                                    When enabled, content will be synced and searchable
                                  </p>
                                </div>
                                <Switch
                                  id="enabled"
                                  checked={connection.enabled}
                                  onCheckedChange={(checked) => 
                                    handleToggleEnabled(connection.id, checked)
                                  }
                                  disabled={updateSettingsMutation.isPending}
                                />
                              </div>
                              
                              <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                  <Label>Sync frequency</Label>
                                  <p className="text-sm text-muted-foreground">
                                    {connection.syncFrequency || 'daily'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>

                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDisconnect(connection.id)}
                          disabled={disconnectMutation.isPending}
                          className="w-full"
                        >
                          <Trash2 className="size-4 mr-2" />
                          Disconnect
                        </Button>
                      </div>
                    </>
                  ) : (
                    <Button
                      onClick={() => handleConnect(integration.id)}
                      className="w-full"
                    >
                      <Icon className="size-4 mr-2" />
                      Connect {integration.name}
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Connected Integrations Summary */}
      {connections && connections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Connected Integrations</CardTitle>
            <CardDescription>
              {connections.length} integration{connections.length !== 1 ? 's' : ''} connected
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {connections.map((connection) => {
                const integration = INTEGRATIONS.find(i => i.id === connection.appType)
                if (!integration) return null

                return (
                  <div
                    key={connection.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <integration.icon className={cn("size-5", integration.color)} />
                      <div>
                        <p className="font-medium">{connection.appName}</p>
                        <p className="text-sm text-muted-foreground">
                          Connected {formatDate(connection.connectedAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {connection.enabled ? (
                        <Badge variant="secondary" className="bg-green-500/10 text-green-500">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Disabled</Badge>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

