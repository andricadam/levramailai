import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { QACacheClient } from "@/lib/qa-cache";

export async function POST(req: Request) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { 
            query, 
            response, 
            helpful, 
            accountId, 
            retrievedEmails = [],
            correctedQuery,
            interactionType = "explicit"
        } = body;

        if (!query || !accountId) {
            return NextResponse.json(
                { error: "Query and accountId are required" },
                { status: 400 }
            );
        }

        // Store feedback in database
        await db.chatFeedback.create({
            data: {
                userId,
                accountId,
                query: query || '',
                response: response || '',
                helpful: helpful ?? null, // null for implicit feedback
                retrievedEmails: retrievedEmails || [],
                correctedQuery: correctedQuery || null,
                interactionType: interactionType || 'explicit'
            }
        });

        // ===== Update Q&A Cache based on feedback =====
        try {
            const qaCache = new QACacheClient(accountId);
            await qaCache.initialize();
            
            if (helpful === false) {
                // Remove unhelpful Q&A from cache
                await qaCache.removeUnhelpful(query);
                console.log(`Removed unhelpful Q&A from cache: ${query.substring(0, 50)}...`);
            } else if (helpful === true) {
                // Ensure helpful Q&A is in cache (or update if exists)
                await qaCache.addQA(query, response, true);
                console.log(`Added/updated helpful Q&A in cache: ${query.substring(0, 50)}...`);
            } else if (interactionType === 'correction') {
                // User rephrased - remove old cached version
                await qaCache.removeUnhelpful(query);
                console.log(`Removed corrected Q&A from cache: ${query.substring(0, 50)}...`);
            }
            // For implicit feedback (helpful === null), we don't add to cache yet
            // It will be added when the expensive model generates it, or if user marks it helpful later
        } catch (cacheError) {
            console.error("Failed to update Q&A cache from feedback:", cacheError);
            // Don't fail the feedback submission if cache update fails
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Feedback collection error:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json(
            { error: "Failed to collect feedback", message: errorMessage },
            { status: 500 }
        );
    }
}

