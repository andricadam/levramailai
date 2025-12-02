"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/trpc/react"
import { toast } from "sonner"

interface CreateEventDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultDate?: Date
  defaultTime?: string
}

export function CreateEventDialog({
  open,
  onOpenChange,
  defaultDate,
  defaultTime = "09:00",
}: CreateEventDialogProps) {
  const [title, setTitle] = React.useState("")
  const [date, setDate] = React.useState(
    defaultDate ? defaultDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
  )
  const [startTime, setStartTime] = React.useState(defaultTime)
  const [endTime, setEndTime] = React.useState(
    defaultTime ? (() => {
      const [hours, minutes] = defaultTime.split(':').map(Number)
      const end = new Date()
      end.setHours(hours + 1, minutes)
      return `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`
    })() : "10:00"
  )
  const [location, setLocation] = React.useState("")
  const [description, setDescription] = React.useState("")

  const utils = api.useUtils()
  const createEvent = api.calendar.createEvent.useMutation({
    onSuccess: () => {
      toast.success("Event erfolgreich erstellt")
      onOpenChange(false)
      // Reset form
      setTitle("")
      setLocation("")
      setDescription("")
      // Invalidate queries to refresh the calendar
      void utils.calendar.getEvents.invalidate()
    },
    onError: (error) => {
      toast.error(`Fehler beim Erstellen des Events: ${error.message}`)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim()) {
      toast.error("Bitte geben Sie einen Titel ein")
      return
    }

    // Combine date and time into ISO strings
    const startDateTime = new Date(`${date}T${startTime}:00`).toISOString()
    const endDateTime = new Date(`${date}T${endTime}:00`).toISOString()

    if (endDateTime <= startDateTime) {
      toast.error("Endzeit muss nach Startzeit liegen")
      return
    }

    createEvent.mutate({
      title: title.trim(),
      startDateTime,
      endDateTime,
      description: description.trim() || undefined,
      location: location.trim() || undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Neues Event erstellen</DialogTitle>
            <DialogDescription>
              Erstellen Sie einen neuen Kalendereintrag. Dieser wird auch in Ihrem verknüpften Kalender (Google Calendar oder Outlook) erstellt.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Titel *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Event-Titel"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="date">Datum *</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="startTime">Startzeit *</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="endTime">Endzeit *</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="location">Ort</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Event-Ort (optional)"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Beschreibung</Label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Event-Beschreibung (optional)"
                className="min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={createEvent.isPending}>
              {createEvent.isPending ? "Wird erstellt..." : "Erstellen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
