import axios from "axios";
import type { SyncResponse, SyncUpdatedResponse, EmailMessage, EmailAddress } from "@/types";

export class Account {
    private token: string;

    constructor(token: string) {
        this.token = token;
    }

    private async startSync() {
        const response = await axios.post<SyncResponse>('https://api.aurinko.io/v1/email/sync', {}, {
            headers: {
                Authorization: `Bearer ${this.token}`
            },
            params: {
                daysWithin: 2,
                bodyType: 'html'
            }
        })
        return response.data
    }
    
    async getUpdatedEmails({ deltaToken, pageToken }: { deltaToken?: string, pageToken?: string}) {
        let params: Record<string, string> = {}
        if (deltaToken) params.deltaToken = deltaToken
        if (pageToken) params.pageToken = pageToken

        const response = await axios.get<SyncUpdatedResponse>('https://api.aurinko.io/v1/email/sync/updated', {
            headers: {
                Authorization: `Bearer ${this.token}`
            },
            params
        })
        return response.data
    }

    async performInitialSync() {
        try {
            let syncResponse = await this.startSync()
            while (!syncResponse.ready) {
                await new Promise(resolve => setTimeout(resolve, 1000))
                syncResponse = await this.startSync()
            }

            let storedDeltaToken: string = syncResponse.syncUpdatedToken

            let updatedResponse = await this.getUpdatedEmails({deltaToken: storedDeltaToken})

            if (updatedResponse.nextDeltaToken) {
                // sync has completed
                storedDeltaToken = updatedResponse.nextDeltaToken
            }
            let allEmails : EmailMessage[] = updatedResponse.records

            // fetch al pages if there are more
            while (updatedResponse.nextPageToken) {
                updatedResponse = await this.getUpdatedEmails({pageToken: updatedResponse.nextPageToken})
                allEmails = allEmails.concat(updatedResponse.records)
                if (updatedResponse.nextDeltaToken) {
                    // sync has completed
                    storedDeltaToken = updatedResponse.nextDeltaToken
                }
            }

            console.log('initial sync completed, we have synced', allEmails.length, 'emails')
            console.log('sync completed', storedDeltaToken)
            // store the latest delta token for future incremental syncs

            return {
                emails: allEmails,
                deltaToken: storedDeltaToken
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
        try {
            const response = await axios.post('https://api.aurinko.io/v1/email/messages', {
                from,
                subject,
                body,
                inReplyTo,
                references,
                to,
                threadId,
                cc,
                bcc,
                replyTo
        }, {
            params: {
                returnIds: true
            },
            headers: {
                Authorization: `Bearer ${this.token}`
            },
        })
        console.log('email sent', response.data)
        return response.data
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
