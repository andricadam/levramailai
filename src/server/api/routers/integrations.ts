import { z } from 'zod'
import { privateProcedure, createTRPCRouter } from '../trpc'
import { db } from '@/server/db'
import { syncGoogleDrive } from '@/lib/integrations/google-drive-sync'
import { syncGoogleCalendar } from '@/lib/integrations/google-calendar-sync'
import { syncMicrosoftCalendar } from '@/lib/integrations/microsoft-calendar-sync'
import { syncSharePoint } from '@/lib/integrations/sharepoint-sync'

export const integrationsRouter = createTRPCRouter({
  getConnections: privateProcedure.query(async ({ ctx }) => {
    return await db.appConnection.findMany({
      where: {
        userId: ctx.auth.userId,
      },
      orderBy: {
        connectedAt: 'desc',
      },
    })
  }),

  disconnect: privateProcedure
    .input(z.object({ connectionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const connection = await db.appConnection.findFirst({
        where: {
          id: input.connectionId,
          userId: ctx.auth.userId,
        },
      })

      if (!connection) {
        throw new Error('Connection not found')
      }

      // Delete all synced items
      await db.syncedItem.deleteMany({
        where: { connectionId: input.connectionId },
      })

      // Delete connection
      await db.appConnection.delete({
        where: { id: input.connectionId },
      })

      return { success: true }
    }),

  sync: privateProcedure
    .input(z.object({ connectionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const connection = await db.appConnection.findFirst({
        where: {
          id: input.connectionId,
          userId: ctx.auth.userId,
        },
      })

      if (!connection) {
        throw new Error('Connection not found')
      }

      // Update status to syncing
      await db.appConnection.update({
        where: { id: input.connectionId },
        data: { syncStatus: 'syncing' },
      })

      // Trigger sync in background (don't wait for it)
      if (connection.appType === 'google_drive') {
        syncGoogleDrive(input.connectionId).catch((error) => {
          console.error('Sync error:', error)
        })
      } else if (connection.appType === 'google_calendar') {
        syncGoogleCalendar(input.connectionId).catch((error) => {
          console.error('Sync error:', error)
        })
      } else if (connection.appType === 'microsoft_calendar') {
        syncMicrosoftCalendar(input.connectionId).catch((error) => {
          console.error('Sync error:', error)
        })
      } else if (connection.appType === 'sharepoint') {
        syncSharePoint(input.connectionId).catch((error) => {
          console.error('Sync error:', error)
        })
      }

      return { success: true }
    }),

  updateSettings: privateProcedure
    .input(
      z.object({
        connectionId: z.string(),
        enabled: z.boolean().optional(),
        syncFrequency: z.enum(['hourly', 'daily', 'weekly']).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const connection = await db.appConnection.findFirst({
        where: {
          id: input.connectionId,
          userId: ctx.auth.userId,
        },
      })

      if (!connection) {
        throw new Error('Connection not found')
      }

      return await db.appConnection.update({
        where: { id: input.connectionId },
        data: {
          enabled: input.enabled,
          syncFrequency: input.syncFrequency,
        },
      })
    }),
})

