'use server';
import TurndownService from 'turndown';
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createStreamableValue } from '@ai-sdk/rsc';

const turndown = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
    strongDelimiter: '**',
    bulletListMarker: '-',
    linkStyle: 'inlined',
});

// Remove link tags
turndown.addRule('linkRemover', {
    filter: 'a',
    replacement: (content) => content,
});

// Remove style tags
turndown.addRule('styleRemover', {
    filter: 'style',
    replacement: () => '',
});

// Remove script tags
turndown.addRule('scriptRemover', {
    filter: 'script',
    replacement: () => '',
});

turndown.addRule('imageRemover', {
    filter: 'img',
    replacement: (content) => content,
});

export async function summarizeEmail(emailContent: string, subject: string, from: string, sentAt: string) {
    const stream = createStreamableValue('');

    // Convert HTML to markdown for better text processing
    const markdownContent = turndown.turndown(emailContent || '');

    (async () => {
        const { textStream } = await streamText({
            model: openai('gpt-3.5-turbo'),
            prompt: `
            You are an AI email assistant. Your task is to summarize the following email in a clear, concise, and easy-to-understand way.
            
            THE TIME NOW IS ${new Date().toLocaleString()}
            
            EMAIL DETAILS:
            Subject: ${subject || 'No subject'}
            From: ${from || 'Unknown sender'}
            Sent: ${sentAt || 'Unknown date'}
            
            EMAIL CONTENT:
            ${markdownContent}
            
            Please provide a summary that:
            - Is clear and easy to understand
            - Captures the main points and key information
            - Is concise but comprehensive
            - Uses plain language
            - Highlights any important dates, deadlines, or action items
            - Maintains the tone and context of the original email
            
            Format your response as a well-structured summary. Do not include phrases like "Here's the summary" or "Summary:" - just provide the summary directly.
            `,
        });

        for await (const delta of textStream) {
            stream.update(delta);
        }

        stream.done();
    })();

    return { output: stream.value };
}

