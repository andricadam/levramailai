'use server';

import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createStreamableValue } from '@ai-sdk/rsc';
import { db } from '@/server/db';
import { auth } from '@clerk/nextjs/server';
import { reviseDraft } from '@/lib/tone-of-voice-client';

export async function generateInstantReply(
    context: string,
    metadata?: {
        accountId?: string;
        threadId?: string;
        originalEmailId?: string;
    }
) {
    const { userId } = await auth();
    if (!userId) throw new Error('Unauthorized');
    
    console.log("context", context)
    const stream = createStreamableValue('');
    let fullGeneratedText = '';
    let feedbackId: string | null = null;

    (async () => {
        // Step 1: Generate initial reply with base model (GPT-4)
        const { textStream } = await streamText({
            model: openai('gpt-4-turbo'),
            prompt: `
            You are an AI email assistant embedded in an email client app. Your purpose is to automatically generate a helpful and appropriate reply to the most recent email in the conversation thread.
            
            THE TIME NOW IS ${new Date().toLocaleString()}
            
            START CONTEXT BLOCK
            ${context}
            END OF CONTEXT BLOCK
            
            Based on the email context above, generate an appropriate reply to the most recent email. The reply should:
            - Be professional, helpful, and contextually appropriate
            - Directly address the points raised in the most recent email
            - Maintain a natural, conversational tone
            - Be concise but complete
            - Match the formality level of the original email
            - Include any necessary acknowledgments or responses to questions
            - Don't add fluff like 'Here's your reply' or 'Here is your reply' or anything like that
            - Directly output the email reply content, no need to say 'Here is your reply' or anything like that
            - No need to output subject
            - Start directly with the reply content
            `,
        });

        for await (const delta of textStream) {
            fullGeneratedText += delta;
            stream.update(delta);
        }

        // Step 2: Revise using fine-tuned Mistral model (if available)
        if (userId && metadata?.accountId && fullGeneratedText) {
            try {
                const revised = await reviseDraft(
                    fullGeneratedText,
                    userId,
                    metadata.accountId
                );
                
                // If revision was successful and different, update the stream
                if (revised && revised !== fullGeneratedText && revised.length > 0) {
                    // Replace with revised version
                    stream.update(revised);
                    fullGeneratedText = revised;
                }
            } catch (error) {
                console.error('Failed to revise with fine-tuned model:', error);
                // Continue with original if revision fails
            }
        }

        stream.done();

        // Step 3: Store generated reply for later comparison
        if (userId && metadata?.accountId && fullGeneratedText) {
            try {
                const feedback = await db.instantReplyFeedback.create({
                    data: {
                        userId,
                        accountId: metadata.accountId,
                        threadId: metadata.threadId || null,
                        emailContext: context,
                        originalEmailId: metadata.originalEmailId || null,
                        generatedReply: fullGeneratedText,
                        finalSentReply: null, // Will be updated when email is sent
                        wasEdited: false,
                        modelVersion: 'gpt-4-turbo-revised', // Track which model generated this
                    }
                });
                feedbackId = feedback.id;
            } catch (error) {
                console.error('Failed to track instant reply generation:', error);
            }
        }
    })();

    return { 
        output: stream.value,
        feedbackId // Return so we can link it when email is sent
    };
}

