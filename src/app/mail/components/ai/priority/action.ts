'use server';
import TurndownService from 'turndown';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

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

export async function determineEmailPriority(
    emailContent: string,
    subject: string,
    from: string,
    sentAt: string
): Promise<'high' | 'medium' | 'low'> {
    // Convert HTML to markdown for better text processing
    const markdownContent = turndown.turndown(emailContent || '');

    try {
        const { text } = await generateText({
            model: openai('gpt-4-turbo'),
            prompt: `
            You are an AI email assistant. Your task is to determine the priority level of an incoming email.
            
            THE TIME NOW IS ${new Date().toLocaleString()}
            
            EMAIL DETAILS:
            Subject: ${subject || 'No subject'}
            From: ${from || 'Unknown sender'}
            Sent: ${sentAt || 'Unknown date'}
            
            EMAIL CONTENT:
            ${markdownContent}
            
            Analyze this email and determine its priority level. Consider:
            - Urgency: Does it require immediate attention or action?
            - Importance: Is it from a key contact, about critical matters, or time-sensitive?
            - Content: Does it contain deadlines, urgent requests, important decisions, or critical information?
            - Context: Is it a follow-up, response to something urgent, or contains action items?
            
            Priority levels:
            - HIGH: Urgent emails requiring immediate attention, time-sensitive matters, critical decisions, important deadlines, urgent requests, or emails from key contacts about important matters.
            - MEDIUM: Important but not urgent emails, informational emails that need attention but can wait, regular business communications, or emails that require a response but not immediately.
            - LOW: Newsletters, promotional emails, automated notifications, general updates, or emails that don't require immediate action or response.
            
            Respond with ONLY one word: "high", "medium", or "low". Do not include any other text, explanation, or formatting.
            `,
        });

        const priority = text.trim().toLowerCase();
        
        // Validate and return the priority
        if (priority === 'high' || priority === 'medium' || priority === 'low') {
            return priority;
        }
        
        // Default to medium if the response is unexpected
        console.warn(`Unexpected priority response: "${text}". Defaulting to medium.`);
        return 'medium';
    } catch (error) {
        console.error('Error determining email priority:', error);
        // Default to medium on error
        return 'medium';
    }
}

