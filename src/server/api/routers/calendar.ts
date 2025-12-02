import { z } from "zod";
import { createTRPCRouter, privateProcedure } from "../trpc";
import { db } from "@/server/db";
import { createGoogleCalendarEvent } from '@/lib/integrations/google-calendar-sync'
import { createMicrosoftCalendarEvent } from '@/lib/integrations/microsoft-calendar-sync'

/**
 * Check if a string looks like a date (ISO format)
 */
function isDateString(str: string): boolean {
  if (!str) return false
  // ISO date format: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
  return /^\d{4}-\d{2}-\d{2}(T[\d:.-]+)?/.test(str.trim())
}

/**
 * Check if a string looks like an email address
 */
function isEmailAddress(str: string): boolean {
  if (!str) return false
  // Simple email regex: something@something.something
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str.trim())
}

/**
 * Parse event data from content string
 * The content format from sync is:
 * [title]\n[description]\n[location]\n[attendees]\n[organizer]\n[startDateTime]\n[endDateTime]
 * Note: Empty fields are filtered out, so indices may vary
 */
/**
 * Check if a date string represents an all-day event
 * All-day events have format YYYY-MM-DD (no time component)
 */
function isAllDayEvent(dateString: string | null): boolean {
  if (!dateString) return false
  // All-day events are in format YYYY-MM-DD (exactly 10 characters, no 'T')
  return /^\d{4}-\d{2}-\d{2}$/.test(dateString.trim())
}

function parseEventData(content: string, title: string): {
  start: string | null;
  end: string | null;
  description?: string;
  location?: string;
  allDay?: boolean;
} {
  const lines = content.split('\n').filter(Boolean);
  
  // Find dates at the end (they should be the last 1-2 date-like strings)
  let startTime: string | null = null;
  let endTime: string | null = null;
  
  // Work backwards to find dates
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]?.trim();
    if (!line) continue;
    
    if (isDateString(line)) {
      if (!endTime) {
        endTime = line;
      } else if (!startTime) {
        startTime = line;
        break; // Found both dates
      }
    }
  }
  
  // If only one date found, use it as start
  if (!startTime && endTime) {
    startTime = endTime;
  }
  
  // Extract other fields (everything except title and dates)
  const nonDateLines: string[] = [];
  for (const line of lines) {
    if (!isDateString(line) && line.trim() !== title.trim()) {
      nonDateLines.push(line.trim());
    }
  }
  
  // Try to identify location (often contains address keywords)
  // Exclude email addresses from being recognized as locations
  let location: string | undefined;
  const locationKeywords = ['location', 'address', 'at ', 'in '];
  const locationIndex = nonDateLines.findIndex(line => {
    // Skip if it's an email address
    if (isEmailAddress(line)) {
      return false
    }
    // Check for location keywords (excluding '@' to avoid matching emails)
    return locationKeywords.some(keyword => line.toLowerCase().includes(keyword)) ||
      (line.includes(',') && !isEmailAddress(line)) || // Addresses often have commas, but not emails
      /^\d+/.test(line) // May start with street number
  });

  if (locationIndex >= 0 && !isEmailAddress(nonDateLines[locationIndex] || '')) {
    location = nonDateLines[locationIndex];
    nonDateLines.splice(locationIndex, 1);
  }
  
  // Remaining lines are likely description/attendees/organizer
  const description = nonDateLines.filter(Boolean).join('\n') || undefined;
  
  // Check if this is an all-day event
  const allDay = startTime ? isAllDayEvent(startTime) : false;
  
  return {
    start: startTime,
    end: endTime,
    description,
    location,
    allDay,
  };
}

/**
 * Fetch and transform calendar events from database
 */
async function fetchCalendarEvents(
  userId: string,
  startDate?: string,
  endDate?: string,
  accountId?: string
) {
  // Find calendar connections for this user (both Google and Microsoft)
  // If accountId is provided, filter by it to show only events for the selected account
  const whereClause: any = {
    userId,
    appType: { in: ['google_calendar', 'microsoft_calendar'] },
    enabled: true,
  };

  // Filter by accountId if provided (to show events for the currently selected account)
  if (accountId) {
    whereClause.accountId = accountId;
  }

  const connections = await db.appConnection.findMany({
    where: whereClause,
  });

  if (connections.length === 0) {
    return [];
  }

  // Fetch all events from all matching calendar connections
  const connectionIds = connections.map(c => c.id);
  
  const syncedItems = await db.syncedItem.findMany({
    where: {
      connectionId: { in: connectionIds },
      itemType: 'event',
    },
    orderBy: {
      modifiedAt: 'asc',
    },
  });

  // Transform and parse events
  const allEvents = syncedItems
    .map((item) => {
      const { start, end, description, location, allDay } = parseEventData(item.content, item.title);
      
      // Skip events without valid dates
      if (!start) {
        return null;
      }
      
      return {
        id: item.id,
        title: item.title,
        description,
        location,
        start: start,
        end: end || start, // Default to start if no end time
        allDay: allDay ?? false,
        url: item.url || undefined,
        modifiedAt: item.modifiedAt?.toISOString(),
      };
    })
    .filter((event): event is NonNullable<typeof event> => event !== null);

  // Filter by date range if provided
  if (startDate || endDate) {
    return allEvents.filter((event) => {
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);
      
      if (startDate) {
        const filterStart = new Date(startDate);
        filterStart.setHours(0, 0, 0, 0);
        if (eventEnd < filterStart) {
          return false;
        }
      }
      
      if (endDate) {
        const filterEnd = new Date(endDate);
        filterEnd.setHours(23, 59, 59, 999);
        if (eventStart > filterEnd) {
          return false;
        }
      }
      
      return true;
    });
  }

  return allEvents;
}

export const calendarRouter = createTRPCRouter({
  /**
   * Get calendar events for a date range
   */
  getEvents: privateProcedure
    .input(
      z.object({
        startDate: z.string().optional(), // ISO date string
        endDate: z.string().optional(), // ISO date string
        accountId: z.string().optional(), // Filter by account ID
      })
    )
    .query(async ({ ctx, input }) => {
      return await fetchCalendarEvents(
        ctx.auth.userId,
        input.startDate,
        input.endDate,
        input.accountId
      );
    }),

  /**
   * Get events for a specific date
   */
  getEventsForDate: privateProcedure
    .input(
      z.object({
        date: z.string(), // ISO date string (YYYY-MM-DD)
      })
    )
    .query(async ({ ctx, input }) => {
      const date = new Date(input.date);
      date.setHours(0, 0, 0, 0);
      const startOfDay = date.toISOString();
      
      date.setHours(23, 59, 59, 999);
      const endOfDay = date.toISOString();

      return await fetchCalendarEvents(
        ctx.auth.userId,
        startOfDay,
        endOfDay,
        undefined // getEventsForDate doesn't filter by accountId for now
      );
    }),

  /**
   * Create a new calendar event
   */
  createEvent: privateProcedure
    .input(
      z.object({
        title: z.string().min(1),
        startDateTime: z.string(), // ISO date string or YYYY-MM-DD for all-day
        endDateTime: z.string(), // ISO date string or YYYY-MM-DD for all-day
        allDay: z.boolean().optional().default(false),
        description: z.string().optional(),
        location: z.string().optional(),
        accountId: z.string().optional(), // Filter by account ID
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Find calendar connections for this user
      const whereClause: any = {
        userId: ctx.auth.userId,
        appType: { in: ['google_calendar', 'microsoft_calendar'] },
        enabled: true,
      }

      // Filter by accountId if provided
      if (input.accountId) {
        whereClause.accountId = input.accountId
      }

      const connections = await db.appConnection.findMany({
        where: whereClause,
      })

      if (connections.length === 0) {
        throw new Error('No calendar connection found')
      }

      // Create event in all connected calendars
      const results = await Promise.allSettled(
        connections.map(async (connection) => {
          if (connection.appType === 'google_calendar') {
            return await createGoogleCalendarEvent(
              connection.id,
              input.title,
              input.startDateTime,
              input.endDateTime,
              input.allDay ?? false,
              input.description,
              input.location
            )
          } else if (connection.appType === 'microsoft_calendar') {
            return await createMicrosoftCalendarEvent(
              connection.id,
              input.title,
              input.startDateTime,
              input.endDateTime,
              input.allDay ?? false,
              input.description,
              input.location
            )
          } else {
            throw new Error(`Unsupported calendar type: ${connection.appType}`)
          }
        })
      )

      // Check if at least one succeeded
      const successful = results.filter((r) => r.status === 'fulfilled')
      if (successful.length === 0) {
        const errors = results
          .filter((r) => r.status === 'rejected')
          .map((r) => (r as PromiseRejectedResult).reason)
        throw new Error(`Failed to create event: ${errors.map((e) => e instanceof Error ? e.message : String(e)).join(', ')}`)
      }

      return { success: true, created: successful.length }
    }),
});

