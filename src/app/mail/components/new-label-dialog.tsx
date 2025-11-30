'use client'

import React from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSubmit: (name: string, description: string, color?: string) => void
    editLabel?: {
        id: string
        name: string
        description?: string
        color?: string
    } | null
}

const NewLabelDialog = ({ open, onOpenChange, onSubmit, editLabel }: Props) => {
    const [labelName, setLabelName] = React.useState('')
    const [description, setDescription] = React.useState('')

    // Update form when editLabel changes
    React.useEffect(() => {
        if (editLabel) {
            setLabelName(editLabel.name)
            setDescription(editLabel.description || '')
        } else {
            setLabelName('')
            setDescription('')
        }
    }, [editLabel, open])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (labelName.trim()) {
            onSubmit(labelName.trim(), description.trim(), editLabel?.color)
            setLabelName('')
            setDescription('')
            onOpenChange(false)
        }
    }

    const handleOpenChange = (newOpen: boolean) => {
        onOpenChange(newOpen)
        if (!newOpen) {
            setLabelName('')
            setDescription('')
        }
    }

    const isSubmitDisabled = !labelName.trim()

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{editLabel ? 'Edit Label' : 'New Label'}</DialogTitle>
                    <DialogDescription>
                        {editLabel 
                            ? 'Update the label name and description. The description will help AI automatically categorize emails.'
                            : 'Create a new label to organize your emails. The description will help AI automatically categorize emails.'
                        }
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="label-name">Label Name</Label>
                            <Input
                                id="label-name"
                                placeholder="Enter label name"
                                value={labelName}
                                onChange={(e) => setLabelName(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="label-description">Description</Label>
                            <Textarea
                                id="label-description"
                                placeholder="Describe which kind of emails should be labeled with this label..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={4}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => handleOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitDisabled}
                        >
                            {editLabel ? 'Save' : 'Create'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

export default NewLabelDialog

