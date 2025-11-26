'use client'
import { useState, useRef } from 'react'
import { Paperclip, X, FileText, Loader2, Database } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export type FileAttachment = {
  id: string
  fileName: string
  size: number
  mimeType: string
  status: 'uploading' | 'processing' | 'ready' | 'error'
  inKnowledgeBase: boolean
}

type FileAttachmentSelectorProps = {
  accountId: string
  selectedFiles: FileAttachment[]
  onSelect: (file: FileAttachment) => void
  onRemove: (fileId: string) => void
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export function FileAttachmentSelector({
  accountId,
  selectedFiles,
  onSelect,
  onRemove,
}: FileAttachmentSelectorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [addToKnowledgeBase, setAddToKnowledgeBase] = useState(false) // Default: false

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    for (const file of Array.from(files)) {
      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`File "${file.name}" is too large. Maximum size is 10MB.`)
        continue
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
        continue
      }

      const tempFile: FileAttachment = {
        id: `temp-${Date.now()}-${Math.random()}`,
        fileName: file.name,
        size: file.size,
        mimeType: file.type,
        status: 'uploading',
        inKnowledgeBase: addToKnowledgeBase,
      }

      onSelect(tempFile)
      setUploading(true)

      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('accountId', accountId)
        formData.append('addToKnowledgeBase', String(addToKnowledgeBase))

        const response = await fetch('/api/chat/upload', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Upload failed')
        }

        const data = await response.json()

        onRemove(tempFile.id)
        onSelect({
          ...tempFile,
          id: data.id,
          status: 'ready',
          inKnowledgeBase: data.inKnowledgeBase || false,
        })

        toast.success(
          `File "${file.name}" uploaded${addToKnowledgeBase ? ' and added to knowledge base' : ''}`
        )
      } catch (error) {
        console.error('Upload error:', error)
        onRemove(tempFile.id)
        toast.error(
          `Failed to upload "${file.name}": ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      } finally {
        setUploading(false)
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <div className="space-y-2 mb-2">
      {/* Toggle for Knowledge Base */}
      <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/50">
        <Database className="size-4 text-muted-foreground" />
        <Label htmlFor="kb-toggle" className="text-xs text-muted-foreground cursor-pointer">
          Add to knowledge base
        </Label>
        <Switch
          id="kb-toggle"
          checked={addToKnowledgeBase}
          onCheckedChange={setAddToKnowledgeBase}
          disabled={uploading}
        />
        <span className="text-xs text-muted-foreground">
          (Default: temporary only)
        </span>
      </div>

      {/* Selected file chips */}
      <div className="flex flex-wrap gap-2">
        {selectedFiles.map((file) => (
          <div
            key={file.id}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm border group",
              file.status === 'ready' && "bg-primary/10 border-primary/20",
              file.status === 'uploading' && "bg-muted border-border",
              file.status === 'error' && "bg-destructive/10 border-destructive/20"
            )}
          >
            {file.status === 'uploading' ? (
              <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
            ) : (
              <FileText className="size-3.5 text-primary" />
            )}
            <span className="truncate max-w-[150px] font-medium">
              {file.fileName}
            </span>
            <span className="text-xs text-muted-foreground">
              ({formatFileSize(file.size)})
            </span>
            {file.inKnowledgeBase && (
              <Database className="size-3 text-primary" title="In knowledge base" />
            )}
            {file.status === 'ready' && (
              <button
                onClick={() => onRemove(file.id)}
                className="ml-0.5 hover:bg-primary/20 rounded p-0.5 transition-colors opacity-0 group-hover:opacity-100"
                aria-label="Remove file"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        ))}

        {/* Upload button */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          accept=".pdf,.doc,.docx,.txt,.md,.png,.jpg,.jpeg"
          disabled={uploading}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-dashed text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors disabled:opacity-50"
        >
          <Paperclip className="size-3.5" />
          <span>{uploading ? 'Uploading...' : 'Attach files (max 10MB)'}</span>
        </button>
      </div>
    </div>
  )
}

