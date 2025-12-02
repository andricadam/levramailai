import axios from "axios";
import type { EmailMessage, EmailAddress } from "@/types";
import { db, retryDbOperation } from "@/server/db";
import { syncEmailsToDatabase } from "./sync-emails";
import { GmailAPI } from "./email-api/gmail-api";
import { MicrosoftGraphAPI } from "./email-api/microsoft-graph-api";
import { GoogleEmailOAuth } from "./email-oauth/google-email-oauth";
import { MicrosoftEmailOAuth } from "./email-oauth/microsoft-email-oauth";

export class Account {
    private token: string;
    private accountId?: string;
    private provider?: 'google' | 'microsoft';

    constructor(token: string, accountId?: string) {
        this.token = token;
        this.accountId = accountId;
    }

    private async getAccount() {
        if (this.accountId) {
            const account = await db.account.findUnique({
                where: { id: this.accountId },
                select: { id: true, provider: true, accessToken: true, refreshToken: true, expiresAt: true, nextDeltaToken: true }
            });
            if (account) {
                this.provider = account.provider as 'google' | 'microsoft';
                this.token = account.accessToken;
                return account;
            }
        } else {
            // Fallback: find by accessToken (for backward compatibility)
            const account = await db.account.findFirst({
                where: { accessToken: this.token },
                select: { id: true, provider: true, accessToken: true, refreshToken: true, expiresAt: true, nextDeltaToken: true }
            });
            if (account) {
                this.accountId = account.id;
                this.provider = account.provider as 'google' | 'microsoft';
                return account;
            }
        }
        return null;
    }

    private async ensureValidToken() {
        const account = await this.getAccount();
        if (!account) {
            throw new Error('Account not found');
        }

        // Check if token needs refresh
        if (account.expiresAt && account.refreshToken) {
            const expiresIn = account.expiresAt.getTime() - Date.now();
            // Refresh if expires in less than 5 minutes
            if (expiresIn < 5 * 60 * 1000) {
                await this.refreshAccessToken(account);
            }
        } else if (account.refreshToken) {
            // If we have a refresh token but no expiry, try to refresh anyway
            await this.refreshAccessToken(account);
        }
    }

    private async refreshAccessToken(account: any) {
        try {
            let newTokens;
            if (account.provider === 'google') {
                const oauth = new GoogleEmailOAuth();
                newTokens = await oauth.refreshToken(account.refreshToken);
            } else if (account.provider === 'microsoft') {
                const oauth = new MicrosoftEmailOAuth();
                newTokens = await oauth.refreshToken(account.refreshToken);
            } else {
                throw new Error(`Unsupported provider: ${account.provider}`);
            }

            // Update token in database
            // Convert expiry_date to Date (handles both timestamp numbers and Date objects)
            const expiresAtDate = newTokens.expiry_date 
                ? new Date(newTokens.expiry_date) 
                : null;

            await db.account.update({
                where: { id: account.id },
                data: {
                    accessToken: newTokens.access_token,
                    refreshToken: newTokens.refresh_token || account.refreshToken,
                    expiresAt: expiresAtDate || account.expiresAt || null,
                },
            });

            this.token = newTokens.access_token;
            console.log(`Token refreshed for account ${account.emailAddress}`);
            return newTokens.access_token;
        } catch (error) {
            console.error('Token refresh failed:', error);
            throw new Error('Token refresh failed. Please reconnect your account.');
        }
    }

    /**
     * Creates a token refresh callback function for API instances
     * This will be called automatically when a 401 error occurs
     */
    private createTokenRefreshCallback(): () => Promise<string> {
        return async () => {
            const account = await this.getAccount();
            if (!account) {
                throw new Error('Account not found');
            }
            return await this.refreshAccessToken(account);
        };
    }
    
    async getUpdatedEmails({ deltaToken, pageToken, recentOnly = false }: { deltaToken?: string, pageToken?: string, recentOnly?: boolean}) {
        await this.ensureValidToken();
        const account = await this.getAccount();
        if (!account) throw new Error('Account not found');

        const tokenRefreshCallback = this.createTokenRefreshCallback();

        if (account.provider === 'google') {
            const gmail = new GmailAPI(this.token, tokenRefreshCallback);
            // For recent emails, query for emails from the last 2 hours to ensure we get the newest ones
            // Gmail API might have a slight delay in indexing, so we use 2 hours to be safe
            let query = 'in:inbox';
            if (recentOnly) {
                const twoHoursAgo = new Date();
                twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);
                const dateStr = twoHoursAgo.toISOString().split('T')[0].replace(/-/g, '/');
                query = `in:inbox after:${dateStr}`;
                console.log(`[SYNC] Querying for recent emails: ${query}`);
            }
            const response = await gmail.listMessages(query, pageToken);
            return {
                records: response.messages,
                nextPageToken: response.nextPageToken,
                nextDeltaToken: response.nextDeltaToken,
            };
        } else if (account.provider === 'microsoft') {
            const graph = new MicrosoftGraphAPI(this.token, tokenRefreshCallback);
            // For Microsoft Graph, use 'Inbox' folder if no deltaToken (for regular syncs)
            // Delta queries work on all messages, so folderId is not needed
            const folderId = deltaToken ? undefined : 'Inbox'
            const response = await graph.listMessages(folderId, deltaToken, pageToken);
            return {
                records: response.messages,
                nextPageToken: response.nextPageToken,
                nextDeltaToken: response.nextDeltaToken,
            };
        } else {
            throw new Error(`Unsupported provider: ${account.provider}`);
        }
    }

    async performInitialSync() {
        await this.ensureValidToken();
        const account = await this.getAccount();
        if (!account) throw new Error('Account not found');

        const tokenRefreshCallback = this.createTokenRefreshCallback();

        try {
            if (account.provider === 'google') {
                const gmail = new GmailAPI(this.token, tokenRefreshCallback);
                await gmail.performInitialSync(account.id);
                // Get updated delta token
                const updatedAccount = await db.account.findUnique({
                    where: { id: account.id },
                    select: { nextDeltaToken: true }
                });
                return {
                    emails: [], // Already synced in performInitialSync
                    deltaToken: updatedAccount?.nextDeltaToken || ''
                };
            } else if (account.provider === 'microsoft') {
                const graph = new MicrosoftGraphAPI(this.token, tokenRefreshCallback);
                await graph.performInitialSync(account.id);
                // Get updated delta token
                const updatedAccount = await db.account.findUnique({
                    where: { id: account.id },
                    select: { nextDeltaToken: true }
                });
                return {
                    emails: [], // Already synced in performInitialSync
                    deltaToken: updatedAccount?.nextDeltaToken || ''
                };
            } else {
                throw new Error(`Unsupported provider: ${account.provider}`);
            }
        } catch (error) {
            if (axios.isAxiosError(error)) {
                console.error('Error during sync:', JSON.stringify(error.response?.data, null, 2))
            } else {
                console.error('Error during sync:', error)
            }
            return null;
        }
    }

    async syncEmails() {
        await this.ensureValidToken();
        const account = await this.getAccount();
        if (!account) throw new Error('Account not found')
        
        // Skip sync for unsupported providers (like old Aurinko accounts)
        if (account.provider !== 'google' && account.provider !== 'microsoft') {
            console.warn(`Skipping sync for unsupported provider: ${account.provider}`)
            return {
                emails: [],
                deltaToken: account.nextDeltaToken || ''
            }
        }
        
        console.log(`[SYNC] Starting email sync for account ${account.id} (provider: ${account.provider})`);
        
        // First, sync recent emails (last 2 hours) to ensure we get the newest ones immediately
        // This is especially important for Vercel where the function might timeout
        let allEmails: EmailMessage[] = [];
        let storedDeltaToken: string = account.nextDeltaToken || '';
        const existingEmailIds = new Set<string>();
        
        try {
            console.log(`[SYNC] Step 1: Syncing recent emails (last 2 hours)...`);
            let recentResponse = await this.getUpdatedEmails({
                deltaToken: account.nextDeltaToken || undefined,
                recentOnly: true
            });
            
            allEmails = recentResponse.records;
            allEmails.forEach(e => existingEmailIds.add(e.id));
            console.log(`[SYNC] Found ${allEmails.length} recent emails`);
            
            if (recentResponse.nextDeltaToken) {
                storedDeltaToken = recentResponse.nextDeltaToken;
            }
            
            // Sync recent emails to database immediately
            if (allEmails.length > 0) {
                try {
                    console.log(`[SYNC] Syncing ${allEmails.length} recent emails to database...`);
                    await syncEmailsToDatabase(account.id, allEmails);
                    console.log(`[SYNC] Successfully synced ${allEmails.length} recent emails`);
                } catch (error) {
                    console.error('[SYNC] Error syncing recent emails to database:', error);
                }
            }
        } catch (error) {
            console.error('[SYNC] Error syncing recent emails:', error);
            // Continue with full sync even if recent sync fails
        }
        
        // Then, do a full sync to catch any emails we might have missed
        // But limit pagination to avoid timeouts on Vercel
        try {
            console.log(`[SYNC] Step 2: Syncing all inbox emails...`);
            let response = await this.getUpdatedEmails({
                deltaToken: account.nextDeltaToken || undefined,
                recentOnly: false
            });
            
            // Merge with recent emails, avoiding duplicates
            const newEmails = response.records.filter(e => !existingEmailIds.has(e.id));
            allEmails = allEmails.concat(newEmails);
            newEmails.forEach(e => existingEmailIds.add(e.id));
            
            if (response.nextDeltaToken) {
                storedDeltaToken = response.nextDeltaToken;
            }
            
            console.log(`[SYNC] Found ${newEmails.length} additional emails from full sync`);
            
            // Limit pagination to 3 pages max to avoid Vercel timeouts
            let pageCount = 0;
            const MAX_PAGES = 3;
            
            while (response.nextPageToken && pageCount < MAX_PAGES) {
                pageCount++;
                console.log(`[SYNC] Fetching page ${pageCount + 1}...`);
                
                // Add delay between pagination requests to avoid rate limits
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                try {
                    response = await this.getUpdatedEmails({ 
                        deltaToken: storedDeltaToken || undefined,
                        pageToken: response.nextPageToken,
                        recentOnly: false
                    });
                    
                    const additionalNewEmails = response.records.filter(e => !existingEmailIds.has(e.id));
                    allEmails = allEmails.concat(additionalNewEmails);
                    additionalNewEmails.forEach(e => existingEmailIds.add(e.id));
                    
                    if (response.nextDeltaToken) {
                        storedDeltaToken = response.nextDeltaToken;
                    }
                    
                    console.log(`[SYNC] Page ${pageCount + 1}: Found ${additionalNewEmails.length} new emails`);
                } catch (error) {
                    // If we hit rate limits during pagination, stop and use what we have
                    if (axios.isAxiosError(error) && error.response?.status === 429) {
                        console.warn(`[SYNC] Rate limit hit during pagination. Stopping sync and using ${allEmails.length} emails fetched so far.`);
                        break;
                    }
                    console.error(`[SYNC] Error fetching page ${pageCount + 1}:`, error);
                    break; // Stop pagination on error
                }
            }
            
            if (pageCount >= MAX_PAGES) {
                console.log(`[SYNC] Reached max page limit (${MAX_PAGES}), stopping pagination`);
            }
        } catch (error) {
            console.error('[SYNC] Error during full sync:', error);
            // Continue with what we have
        }

        // Sync all collected emails to database (final sync to ensure everything is up to date)
        if (allEmails.length > 0) {
            try {
                console.log(`[SYNC] Final sync: Syncing ${allEmails.length} total emails to database...`);
                await syncEmailsToDatabase(account.id, allEmails);
                console.log(`[SYNC] Successfully synced ${allEmails.length} emails to database`);
            } catch (error) {
                console.error('[SYNC] Error syncing emails to database:', error);
            }
        } else {
            console.log(`[SYNC] No new emails to sync`);
        }

        // Update delta token
        try {
            await retryDbOperation(
                async () => {
                    return await db.account.update({
                        where: { id: account.id },
                        data: { nextDeltaToken: storedDeltaToken }
                    });
                },
                5,
                2000
            );
            console.log(`[SYNC] Successfully updated account delta token`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('[SYNC] Failed to update account delta token after retries:', errorMessage);
        }

        console.log(`[SYNC] Email sync completed for account ${account.id}. Total emails synced: ${allEmails.length}`);
        
        return {
            emails: allEmails,
            deltaToken: storedDeltaToken
        }
    }

    async sendEmail({
        from,
        subject,
        body,
        inReplyTo,
        threadId,
        references,
        to,
        cc,
        bcc,
        replyTo
    }: {
        from: EmailAddress,
        subject: string,
        body: string,
        inReplyTo?: string,
        threadId?: string,
        references?: string[],
        to: EmailAddress[],
        cc?: EmailAddress[],
        bcc?: EmailAddress[],
        replyTo?: EmailAddress[]
    }) {
        await this.ensureValidToken();
        const account = await this.getAccount();
        if (!account) throw new Error('Account not found');

        const tokenRefreshCallback = this.createTokenRefreshCallback();

        try {
            if (account.provider === 'google') {
                const gmail = new GmailAPI(this.token, tokenRefreshCallback);
                return await gmail.sendEmail({
                    from,
                    to,
                    subject,
                    body,
                    cc,
                    bcc,
                    replyTo,
                    inReplyTo,
                    references,
                });
            } else if (account.provider === 'microsoft') {
                const graph = new MicrosoftGraphAPI(this.token, tokenRefreshCallback);
                return await graph.sendEmail({
                    from,
                    to,
                    subject,
                    body,
                    cc,
                    bcc,
                    replyTo,
                    inReplyTo,
                    references,
                });
            } else {
                throw new Error(`Unsupported provider: ${account.provider}`);
            }
        } catch (error) {
            if (axios.isAxiosError(error)) {
                console.error('Error sending email:', JSON.stringify(error.response?.data, null, 2))
            } else {
                console.error('Error sending email:', error)
            }
            throw error
        }
    }

    async archiveThread(threadId: string): Promise<void> {
        await this.ensureValidToken();
        const account = await this.getAccount();
        if (!account) throw new Error('Account not found');

        const tokenRefreshCallback = this.createTokenRefreshCallback();

        try {
            if (account.provider === 'google') {
                const gmail = new GmailAPI(this.token, tokenRefreshCallback);
                await gmail.archiveThread(threadId);
            } else if (account.provider === 'microsoft') {
                const graph = new MicrosoftGraphAPI(this.token, tokenRefreshCallback);
                await graph.archiveThread(threadId);
            } else {
                throw new Error(`Unsupported provider: ${account.provider}`);
            }
        } catch (error) {
            if (axios.isAxiosError(error)) {
                console.error('Error archiving thread:', JSON.stringify(error.response?.data, null, 2))
            } else {
                console.error('Error archiving thread:', error)
            }
            throw error
        }
    }

    async deleteThread(threadId: string): Promise<void> {
        await this.ensureValidToken();
        const account = await this.getAccount();
        if (!account) throw new Error('Account not found');

        const tokenRefreshCallback = this.createTokenRefreshCallback();

        try {
            if (account.provider === 'google') {
                const gmail = new GmailAPI(this.token, tokenRefreshCallback);
                await gmail.deleteThread(threadId);
            } else if (account.provider === 'microsoft') {
                const graph = new MicrosoftGraphAPI(this.token, tokenRefreshCallback);
                await graph.deleteThread(threadId);
            } else {
                throw new Error(`Unsupported provider: ${account.provider}`);
            }
        } catch (error) {
            if (axios.isAxiosError(error)) {
                console.error('Error deleting thread:', JSON.stringify(error.response?.data, null, 2))
            } else {
                console.error('Error deleting thread:', error)
            }
            throw error
        }
    }

    async markAsUnread(threadId: string): Promise<void> {
        await this.ensureValidToken();
        const account = await this.getAccount();
        if (!account) throw new Error('Account not found');

        const tokenRefreshCallback = this.createTokenRefreshCallback();

        try {
            if (account.provider === 'google') {
                const gmail = new GmailAPI(this.token, tokenRefreshCallback);
                await gmail.markAsUnread(threadId);
            } else if (account.provider === 'microsoft') {
                const graph = new MicrosoftGraphAPI(this.token, tokenRefreshCallback);
                await graph.markAsUnread(threadId);
            } else {
                throw new Error(`Unsupported provider: ${account.provider}`);
            }
        } catch (error) {
            if (axios.isAxiosError(error)) {
                console.error('Error marking thread as unread:', JSON.stringify(error.response?.data, null, 2))
            } else {
                console.error('Error marking thread as unread:', error)
            }
            throw error
        }
    }
}
