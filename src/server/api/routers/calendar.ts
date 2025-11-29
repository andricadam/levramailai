import { z } from "zod";
import { createTRPCRouter, privateProcedure } from "../trpc";
import { db } from "@/server/db";

/**
 * Check if a string looks like a date (ISO format)
 */
function isDateString(str: string): boolean {
  if (!str) return false
  // ISO date format: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
  return /^\d{4}-\d{2}-\d{2}(T[\d:.-]+)?/.test(str.trim())
}

/**
 * Parse event data from content string
 * The content format from sync is:
 * [title]\n[description]\n[location]\n[attendees]\n[organizer]\n[startDateTime]\n[endDateTime]
 * Note: Empty fields are filtered out, so indices may vary
 */
function parseEventData(content: string, title: string): {
  start: string | null;
  end: string | null;
  description?: string;
  location?: string;
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
  let location: string | undefined;
  const locationKeywords = ['location', 'address', 'at ', 'in ', '@'];
  const locationIndex = nonDateLines.findIndex(line =>
    locationKeywords.some(keyword => line.toLowerCase().includes(keyword)) ||
    line.includes(',') || // Addresses often have commas
    /^\d+/.test(line) // May start with street number
  );
  
  if (locationIndex >= 0) {
    location = nonDateLines[locationIndex];
    nonDateLines.splice(locationIndex, 1);
  }
  
  // Remaining lines are likely description/attendees/organizer
  const description = nonDateLines.filter(Boolean).join('\n') || undefined;
  
  return {
    start: startTime,
    end: endTime,
    description,
    location,
  };
}

/**
 * Fetch and transform calendar events from database
 */
async function fetchCalendarEvents(
  userId: string,
  startDate?: string,
  endDate?: string
) {
  // Find Google Calendar connection for this user (linked to Google email accounts)
  // Since calendar scopes are included in email OAuth, there should be one calendar connection per user
  const connection = await db.appConnection.findFirst({
    where: {
      userId,
      appType: 'google_calendar',
      enabled: true,
    },
  });

  if (!connection) {
    return [];
  }

  // Fetch all events from the calendar connection
  const connectionIds = [connection.id];
  
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
      const { start, end, description, location } = parseEventData(item.content, item.title);
      
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
      })
    )
    .query(async ({ ctx, input }) => {
      return await fetchCalendarEvents(
        ctx.auth.userId,
        input.startDate,
        input.endDate
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
        endOfDay
      );
    }),
});

