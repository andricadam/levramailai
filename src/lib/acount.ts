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
                    await db.account.update({
                        where: { id: account.id },
                        data: {
                            accessToken: newTokens.access_token,
                            refreshToken: newTokens.refresh_token || account.refreshToken,
                            expiresAt: newTokens.expiry_date || account.expiresAt,
                        },
                    });

                    this.token = newTokens.access_token;
                } catch (error) {
                    console.error('Token refresh failed:', error);
                    throw new Error('Token refresh failed');
                }
            }
        }
    }
    
    async getUpdatedEmails({ deltaToken, pageToken }: { deltaToken?: string, pageToken?: string}) {
        await this.ensureValidToken();
        const account = await this.getAccount();
        if (!account) throw new Error('Account not found');

        if (account.provider === 'google') {
            const gmail = new GmailAPI(this.token);
            const response = await gmail.listMessages(undefined, pageToken);
            return {
                records: response.messages,
                nextPageToken: response.nextPageToken,
                nextDeltaToken: response.nextDeltaToken,
            };
        } else if (account.provider === 'microsoft') {
            const graph = new MicrosoftGraphAPI(this.token);
            const response = await graph.listMessages(undefined, deltaToken, pageToken);
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

        try {
            if (account.provider === 'google') {
                const gmail = new GmailAPI(this.token);
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
                const graph = new MicrosoftGraphAPI(this.token);
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
            response = await this.getUpdatedEmails({ 
                deltaToken: storedDeltaToken || undefined,
                pageToken: response.nextPageToken 
            })
            allEmails = allEmails.concat(response.records)
            if (response.nextDeltaToken) {
                storedDeltaToken = response.nextDeltaToken
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

        try {
            if (account.provider === 'google') {
                const gmail = new GmailAPI(this.token);
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
                const graph = new MicrosoftGraphAPI(this.token);
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
}
