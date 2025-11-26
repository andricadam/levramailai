/**
 * Client for tone-of-voice fine-tuning service
 * Connects to Python service running on Railway
 */

const TONE_OF_VOICE_SERVICE_URL = process.env.NEXT_PUBLIC_TONE_OF_VOICE_SERVICE_URL || 
                                   process.env.TONE_OF_VOICE_SERVICE_URL || 
                                   'http://localhost:8000';

export interface DraftFinalPair {
    draft: string;
    final: string;
    userId: string;
    accountId: string;
}

export interface RevisionRequest {
    draft_text: string;
    userId: string;
    accountId: string;
}

export interface TrainingStatus {
    userId: string;
    accountId: string;
}

/**
 * Log a draft/final pair for training
 */
export async function logDraftFinalPair(pair: DraftFinalPair): Promise<void> {
    try {
        const response = await fetch(`${TONE_OF_VOICE_SERVICE_URL}/api/log-pair`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pair),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to log draft/final pair: ${error}`);
        }
    } catch (error) {
        console.error('Failed to log draft/final pair:', error);
        // Don't throw - logging failures shouldn't break the app
    }
}

/**
 * Revise a draft using the fine-tuned Mistral model
 */
export async function reviseDraft(
    draftText: string,
    userId: string,
    accountId: string
): Promise<string> {
    try {
        const response = await fetch(`${TONE_OF_VOICE_SERVICE_URL}/api/revise`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                draft_text: draftText,
                userId,
                accountId,
            }),
        });

        if (!response.ok) {
            throw new Error('Failed to revise draft');
        }

        const data = await response.json();
        return data.revised || draftText; // Fallback to original if revision fails
    } catch (error) {
        console.error('Failed to revise draft:', error);
        return draftText; // Fallback to original
    }
}

/**
 * Trigger fine-tuning (called periodically or when enough data collected)
 */
export async function triggerFineTuning(userId: string, accountId: string): Promise<void> {
    try {
        const response = await fetch(`${TONE_OF_VOICE_SERVICE_URL}/api/trigger-fine-tuning`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId,
                accountId,
            }),
        });

        if (!response.ok) {
            throw new Error('Failed to trigger fine-tuning');
        }

        const data = await response.json();
        console.log('Fine-tuning status:', data);
    } catch (error) {
        console.error('Failed to trigger fine-tuning:', error);
    }
}

/**
 * Get training status for a user/account
 */
export async function getTrainingStatus(
    userId: string,
    accountId: string
): Promise<{
    pairs_count: number;
    model_exists: boolean;
    model_loaded: boolean;
    ready_for_training: boolean;
}> {
    try {
        const response = await fetch(
            `${TONE_OF_VOICE_SERVICE_URL}/api/status/${userId}/${accountId}`
        );

        if (!response.ok) {
            throw new Error('Failed to get training status');
        }

        return await response.json();
    } catch (error) {
        console.error('Failed to get training status:', error);
        return {
            pairs_count: 0,
            model_exists: false,
            model_loaded: false,
            ready_for_training: false,
        };
    }
}

