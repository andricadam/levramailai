'use server';

import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createStreamableValue } from '@ai-sdk/rsc';

export async function generateInstantReply(context: string) {
    console.log("context", context)
    const stream = createStreamableValue('');

    (async () => {
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
            stream.update(delta);
        }

        stream.done();
    })();

    return { output: stream.value };
}

