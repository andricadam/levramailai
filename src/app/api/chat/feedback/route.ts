import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";

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

