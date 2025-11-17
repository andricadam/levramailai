import { Webhook } from 'svix';
import { headers } from 'next/headers';
import type { WebhookEvent } from '@clerk/nextjs/server';
import { db } from '@/server/db';
import { env } from '@/env';

export async function POST(req: Request) {
  // Get the Svix headers for verification
  const headerPayload = await headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error occurred -- no svix headers', {
      status: 400,
    });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Get the webhook secret from environment variables
  const WEBHOOK_SECRET = env.WEBHOOK_SECRET;

  // Create a new Svix instance with your webhook secret
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return new Response('Error occurred', {
      status: 400,
    });
  }

  // Handle the webhook
  const eventType = evt.type;
  console.log('Clerk webhook received:', eventType);
  console.log('Full webhook data:', JSON.stringify(evt.data, null, 2));

  if (eventType === 'user.created' || eventType === 'user.updated') {
    const { id, email_addresses, first_name, last_name, image_url, primary_email_address_id } = evt.data;

    try {
      console.log('Email addresses:', email_addresses);
      console.log('Primary email address ID:', primary_email_address_id);

      // Get the primary email address - try multiple methods
      let primaryEmail: string | undefined;

      // Method 1: Find by primary_email_address_id
      if (primary_email_address_id && email_addresses) {
        const primaryEmailObj = email_addresses.find(
          (email: { id: string; email_address: string }) => email.id === primary_email_address_id
        );
        primaryEmail = primaryEmailObj?.email_address;
      }

      // Method 2: Find the first verified email
      if (!primaryEmail && email_addresses) {
        const verifiedEmail = email_addresses.find(
          (email) => email.verification?.status === 'verified'
        );
        primaryEmail = verifiedEmail?.email_address;
      }

      // Method 3: Just get the first email
      if (!primaryEmail && email_addresses && email_addresses.length > 0) {
        primaryEmail = email_addresses[0]?.email_address;
      }

      if (!id) {
        console.error('No user ID found in webhook data');
        return new Response('No user ID found', { status: 400 });
      }

      // Handle test webhooks that don't have email addresses
      if (!primaryEmail) {
        console.warn('No email address found in webhook data - this might be a test webhook');
        console.warn('Available data:', {
          id,
          email_addresses,
          primary_email_address_id,
          first_name,
          last_name,
        });
        // Return 200 for test webhooks so Clerk doesn't mark them as failed
        // In production, real user webhooks should always have email addresses
        return new Response('Webhook received (test webhook - no email)', { status: 200 });
      }

      // Upsert user (create or update) - only if we have an email
      await db.user.upsert({
        where: { id: id },
        update: {
          emailAddress: primaryEmail,
          firstName: first_name ?? '',
          lastName: last_name ?? '',
          imageUrl: image_url ?? null,
        },
        create: {
          id: id,
          emailAddress: primaryEmail,
          firstName: first_name ?? '',
          lastName: last_name ?? '',
          imageUrl: image_url ?? null,
        },
      });

      console.log('User saved to database:', id);
      return new Response('User saved', { status: 200 });
    } catch (error) {
      console.error('Error saving user to database:', error);
      return new Response(
        `Error saving user: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { status: 500 }
      );
    }
  }

  return new Response('Webhook received', { status: 200 });
}