'use client'

import React from 'react'
import { Plus, ChevronDown, MoreVertical, Palette, Edit, Trash2, Check, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import NewLabelDialog from './new-label-dialog'
import { api } from '@/trpc/react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type Label = {
    id: string
    name: string
    description?: string | null
    color?: string
}

type Props = {
    isCollapsed: boolean
}

// Predefined color options
const LABEL_COLORS = [
    { name: 'Red', value: '#ef4444' },
    { name: 'Orange', value: '#f97316' },
    { name: 'Amber', value: '#f59e0b' },
    { name: 'Yellow', value: '#eab308' },
    { name: 'Lime', value: '#84cc16' },
    { name: 'Green', value: '#22c55e' },
    { name: 'Emerald', value: '#10b981' },
    { name: 'Teal', value: '#14b8a6' },
    { name: 'Cyan', value: '#06b6d4' },
    { name: 'Sky', value: '#0ea5e9' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Indigo', value: '#6366f1' },
    { name: 'Violet', value: '#8b5cf6' },
    { name: 'Purple', value: '#a855f7' },
    { name: 'Fuchsia', value: '#d946ef' },
    { name: 'Pink', value: '#ec4899' },
    { name: 'Rose', value: '#f43f5e' },
    { name: 'Gray', value: '#6b7280' },
]

const LabelsSection = ({ isCollapsed }: Props) => {
    const [open, setOpen] = React.useState(false)
    const [editingLabel, setEditingLabel] = React.useState<Label | null>(null)
    const [showMore, setShowMore] = React.useState(false)

    const utils = api.useUtils()
    const { data: labels = [], isLoading } = api.labels.getLabels.useQuery()
    const createLabel = api.labels.createLabel.useMutation({
        onSuccess: () => {
            utils.labels.getLabels.invalidate()
            setOpen(false)
        }
    })
    const updateLabel = api.labels.updateLabel.useMutation({
        onSuccess: () => {
            utils.labels.getLabels.invalidate()
            setEditingLabel(null)
            setOpen(false)
        }
    })
    const deleteLabel = api.labels.deleteLabel.useMutation({
        onSuccess: () => {
            utils.labels.getLabels.invalidate()
        }
    })

    const handleCreateLabel = (name: string, description: string, color?: string) => {
        if (editingLabel) {
            // Update existing label - only update color if explicitly provided
            updateLabel.mutate({
                id: editingLabel.id,
                name,
                description,
                ...(color && { color }),
            })
        } else {
            // Create new label
            createLabel.mutate({
                name,
                description,
                color: color || '#6b7280',
            })
        }
    }

    const handleEditLabel = (label: Label) => {
        setEditingLabel(label)
        setOpen(true)
    }

    const handleDeleteLabel = (labelId: string) => {
        if (confirm('Are you sure you want to delete this label?')) {
            deleteLabel.mutate({ id: labelId })
        }
    }

    const handleColorChange = (labelId: string, color: string) => {
        const label = labels.find(l => l.id === labelId)
        if (label) {
            updateLabel.mutate({
                id: labelId,
                color,
            })
        }
    }

    const handleDialogClose = (newOpen: boolean) => {
        setOpen(newOpen)
        if (!newOpen) {
            setEditingLabel(null)
        }
    }

    // Show first 6 labels, then "More" option
    const displayedLabels = showMore ? labels : labels.slice(0, 6)
    const hasMoreLabels = labels.length > 6

    if (isCollapsed) {
        return (
            <div className="px-2">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setOpen(true)}
                    className="h-9 w-9"
                >
                    <Plus className="w-4 h-4" />
                </Button>
                <NewLabelDialog
                    open={open}
                    onOpenChange={handleDialogClose}
                    onSubmit={handleCreateLabel}
                    editLabel={editingLabel}
                />
            </div>
        )
    }

    return (
        <div className="py-2 w-full">
            <div className="px-2 flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold text-foreground">Labels</h2>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setOpen(true)}
                    className="h-8 w-8"
                >
                    <Plus className="w-4 h-4" />
                </Button>
            </div>
            <div className="px-2 space-y-0.5">
                {isLoading ? (
                    <p className="text-sm text-muted-foreground px-2 py-1">
                        Loading...
                    </p>
                ) : displayedLabels.length === 0 ? (
                    <p className="text-sm text-muted-foreground px-2 py-1">
                        No labels yet
                    </p>
                ) : (
                    displayedLabels.map((label) => (
                        <div
                            key={label.id}
                            className="group w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                        >
                            <button
                                type="button"
                                className="flex items-center gap-2 flex-1 min-w-0 justify-start"
                            >
                                <Tag 
                                    className="w-4 h-4 shrink-0"
                                    style={{ color: label.color || '#6b7280' }}
                                />
                                <span className="truncate">{label.name}</span>
                            </button>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <MoreVertical className="w-4 h-4" />
                                        <span className="sr-only">Label options</span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" side="right">
                                    <DropdownMenuSub>
                                        <DropdownMenuSubTrigger>
                                            <Palette className="w-4 h-4" />
                                            <span>Label Color</span>
                                        </DropdownMenuSubTrigger>
                                        <DropdownMenuSubContent>
                                            {LABEL_COLORS.map((color) => (
                                                <DropdownMenuItem
                                                    key={color.value}
                                                    onClick={() => handleColorChange(label.id, color.value)}
                                                    className="flex items-center gap-2"
                                                >
                                                    <div
                                                        className="w-4 h-4 rounded-full border border-border"
                                                        style={{ backgroundColor: color.value }}
                                                    />
                                                    <span>{color.name}</span>
                                                    {label.color === color.value && (
                                                        <Check className="w-4 h-4 ml-auto" />
                                                    )}
                                                </DropdownMenuItem>
                                            ))}
                                        </DropdownMenuSubContent>
                                    </DropdownMenuSub>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => handleEditLabel(label)}>
                                        <Edit className="w-4 h-4" />
                                        <span>Edit</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        variant="destructive"
                                        onClick={() => handleDeleteLabel(label.id)}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        <span>Delete</span>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    ))
                )}
                {hasMoreLabels && !showMore && (
                    <button
                        type="button"
                        onClick={() => setShowMore(true)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-foreground hover:bg-accent hover:text-accent-foreground transition-colors justify-start"
                    >
                        <ChevronDown className="w-4 h-4 shrink-0" />
                        <span>More</span>
                    </button>
                )}
            </div>
            <NewLabelDialog
                open={open}
                onOpenChange={handleDialogClose}
                onSubmit={handleCreateLabel}
                editLabel={editingLabel}
            />
        </div>
    )
}

export default LabelsSection

