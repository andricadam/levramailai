'use server';

import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function improveText(selectedText: string): Promise<string> {
    if (!selectedText || selectedText.trim().length === 0) {
        throw new Error('No text selected');
    }

    try {
        const { text } = await generateText({
            model: openai('gpt-4'),
            prompt: `
You are a helpful AI assistant embedded in an email client. Your task is to improve and refine a selected piece of text from an email.

CRITICAL LANGUAGE RULE:
- MAINTAIN THE EXACT SAME LANGUAGE AS THE ORIGINAL TEXT
- If the text is in German, return improved German text (NOT a translation)
- If the text is in English, return improved English text
- NEVER translate the text to another language
- Focus on grammar, style, and clarity improvements in the SAME language

IMPORTANT RULES:
- ALWAYS RESPOND IN PLAIN TEXT, no HTML or markdown formatting
- Only return the improved version of the text, nothing else
- Keep the same tone and style as the original text
- Make the text more clear, professional, and well-written
- Improve grammar, spelling, and sentence structure in the original language
- Do not add explanations, comments, or meta-text like "Here's the improved version:"
- Do not change the meaning or intent of the text
- Keep it concise - only improve what needs improvement
- If the text is already good, make minor refinements only

Original text to improve:
${selectedText}

Return only the improved text in the SAME language as the original:
            `,
            temperature: 0.7,
            maxTokens: 500,
        });

        return text.trim();
    } catch (error) {
        console.error('Error improving text:', error);
        throw new Error('Failed to improve text');
    }
}
