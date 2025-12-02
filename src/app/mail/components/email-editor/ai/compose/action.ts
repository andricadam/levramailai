'use server';

import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createStreamableValue } from '@ai-sdk/rsc';
import { db } from '@/server/db';
import { auth } from '@clerk/nextjs/server';
import { reviseDraft } from '@/lib/tone-of-voice-client';

export async function generateEmail(
    context: string,
    prompt: string,
    metadata?: {
        accountId?: string;
        threadId?: string;
    }
) {
    const { userId } = await auth();
    if (!userId) throw new Error('Unauthorized');
    
    console.log("context", context)
    const stream = createStreamableValue('');
    let fullGeneratedText = '';
    let feedbackId: string | null = null;

    (async () => {
        // Step 1: Generate initial email with base model (GPT-4)
        const { textStream } = await streamText({
            model: openai('gpt-4'),
            prompt: `
            You are an AI email assistant embedded in an email client app. Your purpose is to help the user compose emails by providing suggestions and relevant information based on the context of their previous emails.
            
            THE TIME NOW IS ${new Date().toLocaleString()}
            
            START CONTEXT BLOCK
            ${context}
            END OF CONTEXT BLOCK
            
            USER PROMPT:
            ${prompt}
            
            When responding, please keep in mind:
            - Be helpful, clever, and articulate. 
            - Rely on the provided email context to inform your response.
            - If the context does not contain enough information to fully address the prompt, politely give a draft response.
            - Avoid apologizing for previous responses. Instead, indicate that you have updated your knowledge based on new information.
            - Do not invent or speculate about anything that is not directly supported by the email context.
            - Keep your response focused and relevant to the user's prompt.
            - Don't add fluff like 'Heres your email' or 'Here's your email' or anything like that.
            - Directly output the email, no need to say 'Here is your email' or anything like that.
            - No need to output subject
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

        // Step 3: Store generated email for later comparison
        if (userId && metadata?.accountId && fullGeneratedText) {
            try {
                const feedback = await db.instantReplyFeedback.create({
                    data: {
                        userId,
                        accountId: metadata.accountId,
                        threadId: metadata.threadId || null,
                        type: 'compose', // Mark as compose type
                        emailContext: context,
                        userPrompt: prompt, // Store the user's prompt for compose
                        originalEmailId: null, // Not applicable for compose
                        generatedReply: fullGeneratedText,
                        finalSentReply: null, // Will be updated when email is sent
                        wasEdited: false,
                        modelVersion: 'gpt-4-revised', // Track which model generated this
                    }
                });
                feedbackId = feedback.id;
            } catch (error) {
                console.error('Failed to track AI compose generation:', error);
            }
        }
    })();

    return { 
        output: stream.value,
        feedbackId // Return so we can link it when email is sent
    };
}

