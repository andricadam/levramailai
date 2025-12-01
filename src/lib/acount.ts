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
    
    async getUpdatedEmails({ deltaToken, pageToken }: { deltaToken?: string, pageToken?: string}) {
        await this.ensureValidToken();
        const account = await this.getAccount();
        if (!account) throw new Error('Account not found');

        const tokenRefreshCallback = this.createTokenRefreshCallback();

        if (account.provider === 'google') {
            const gmail = new GmailAPI(this.token, tokenRefreshCallback);
            // Query for inbox messages to ensure we sync inbox emails
            // Use 'in:inbox' to filter for inbox messages only
            const response = await gmail.listMessages('in:inbox', pageToken);
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
        
        // Google and Microsoft can sync without delta token (they'll handle it in their API clients)
        let response = await this.getUpdatedEmails({
            deltaToken: account.nextDeltaToken || undefined
        })
        let allEmails: EmailMessage[] = response.records
        let storedDeltaToken: string = account.nextDeltaToken || ''

        if (response.nextDeltaToken) {
            storedDeltaToken = response.nextDeltaToken
        }

        while (response.nextPageToken) {
            // Add significant delay between pagination requests to avoid rate limits
            // Gmail allows ~250 quota units per user per second, but we'll be conservative
            // Wait 2 seconds between pagination requests
            await new Promise(resolve => setTimeout(resolve, 2000))
            
            try {
                response = await this.getUpdatedEmails({ 
                    deltaToken: storedDeltaToken || undefined,
                    pageToken: response.nextPageToken 
                })
                allEmails = allEmails.concat(response.records)
                if (response.nextDeltaToken) {
                    storedDeltaToken = response.nextDeltaToken
                }
            } catch (error) {
                // If we hit rate limits during pagination, stop and use what we have
                if (axios.isAxiosError(error) && error.response?.status === 429) {
                    console.warn(`Rate limit hit during pagination. Stopping sync and using ${allEmails.length} emails fetched so far.`)
                    break
                }
                throw error
            }
        }

        try {
            console.log(`Syncing ${allEmails.length} emails to database`)
            await syncEmailsToDatabase(account.id, allEmails)
        } catch (error) {
            console.error('Error syncing emails to database:', error);
        }

        console.log('Waiting 2 seconds before updating account delta token...');
        await new Promise(resolve => setTimeout(resolve, 2000));

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
            console.log('Successfully updated account delta token');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('Failed to update account delta token after retries:', errorMessage);
        }

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
