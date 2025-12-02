'use server';

import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

/**
 * Server-side function to generate instant reply without streaming
 * Used for background generation during email sync
 */
export async function generateInstantReplyServer(context: string): Promise<string> {
    console.log("Generating instant reply with context length:", context.length);
    
    try {
        const { text } = await generateText({
            model: openai('gpt-4'),
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

        return text;
    } catch (error) {
        console.error('Error generating instant reply:', error);
        throw error;
    }
}

