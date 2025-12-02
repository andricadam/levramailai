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

export async function shouldGenerateReply(
    emailContent: string,
    subject: string,
    from: string,
    sentAt: string,
    sysLabels: string[],
    sysClassifications: string[]
): Promise<boolean> {
    // Skip if email is already marked as spam, junk, or promotional
    const sysLabelsLower = sysLabels.map(label => label.toLowerCase());
    if (sysLabelsLower.includes('spam') || 
        sysLabelsLower.includes('junk') ||
        sysClassifications.includes('promotions') || 
        sysClassifications.includes('spam')) {
        return false;
    }

    const markdownContent = turndown.turndown(emailContent || '');

    try {
        const { text } = await generateText({
            model: openai('gpt-3.5-turbo'),
            prompt: `
            You are an AI email assistant. Determine if an incoming email should receive an automatic reply draft.
            
            THE TIME NOW IS ${new Date().toLocaleString()}
            
            EMAIL DETAILS:
            Subject: ${subject || 'No subject'}
            From: ${from || 'Unknown sender'}
            Sent: ${sentAt || 'Unknown date'}
            Labels: ${sysLabels.join(', ')}
            Classifications: ${sysClassifications.join(', ')}
            
            EMAIL CONTENT:
            ${markdownContent.substring(0, 2000)} ${markdownContent.length > 2000 ? '...' : ''}
            
            Determine if this email should receive an automatic reply draft. Consider:
            - Is it spam, promotional, or automated (newsletters, marketing, etc.)? → NO
            - Is it a personal/business email that likely needs a response? → YES
            - Does it contain questions, requests, or require acknowledgment? → YES
            - Is it from a known contact or business relationship? → YES
            - Is it an automated system notification that doesn't need a reply? → NO
            - Does it look like it requires human response? → YES
            - Is it a "no-reply" email or automated notification? → NO
            
            Respond with ONLY one word: "yes" or "no". Do not include any other text.
            `,
        });

        const shouldReply = text.trim().toLowerCase();
        return shouldReply === 'yes';
    } catch (error) {
        console.error('Error determining reply eligibility:', error);
        // Default to false on error to avoid generating unnecessary replies
        return false;
    }
}

