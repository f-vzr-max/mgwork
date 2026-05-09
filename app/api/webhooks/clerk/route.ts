import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { clerkClient } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/config';
import type { Role, Language } from '@prisma/client';

type ClerkEmailAddress = {
  id: string;
  email_address: string;
};

type ClerkUserPayload = {
  id: string;
  email_addresses: ClerkEmailAddress[];
  primary_email_address_id: string;
  public_metadata: {
    role?: string;
    lang?: string;
  };
  unsafe_metadata?: {
    role?: string;
  };
};

type WebhookEvent = {
  type: string;
  data: ClerkUserPayload;
};

const VALID_ROLES = new Set<Role>([
  'SUPER_ADMIN',
  'ADMIN',
  'STAFF_FOLLOWUP',
  'STAFF_DOCUMENTS',
  'ENTERPRISE',
  'CANDIDATE',
]);

// unsafeMetadata is user-mutable (set by the Clerk client at sign-up). Only
// these two roles may be self-promoted. ADMIN / STAFF / SUPER_ADMIN must be
// granted exclusively via the admin role-update endpoint, never from a
// client-side metadata field.
const SELF_PROMOTABLE_ROLES = new Set<Role>(['CANDIDATE', 'ENTERPRISE']);

export async function POST(req: Request) {
  const secret = env.clerkWebhookSecret();
  if (!secret) {
    console.error('CLERK_WEBHOOK_SECRET not set');
    return new NextResponse('Server misconfiguration', { status: 500 });
  }

  const body = await req.text();
  const headersList = headers();

  const svixId = headersList.get('svix-id');
  const svixTimestamp = headersList.get('svix-timestamp');
  const svixSignature = headersList.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new NextResponse('Missing svix headers', { status: 400 });
  }

  let event: WebhookEvent;
  try {
    const wh = new Webhook(secret);
    event = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as WebhookEvent;
  } catch {
    return new NextResponse('Invalid signature', { status: 400 });
  }

  const { type, data } = event;

  if (type !== 'user.created' && type !== 'user.updated') {
    return NextResponse.json({ status: 'ignored' });
  }

  const primaryEmail = data.email_addresses.find(
    (e) => e.id === data.primary_email_address_id
  )?.email_address;

  if (!primaryEmail) {
    return new NextResponse('No primary email', { status: 400 });
  }

  // Resolve role with this priority:
  //   1. publicMetadata.role (set by admin endpoint or by a prior promotion)
  //   2. unsafeMetadata.role from the sign-up choice — ONLY on user.created and
  //      ONLY if the requested role is self-promotable (CANDIDATE/ENTERPRISE).
  //      Restricting to user.created prevents a returning user from clearing
  //      publicMetadata and re-triggering promotion on user.updated.
  //   3. Default CANDIDATE.
  //
  // SECURITY: unsafe_metadata is user-mutable. Allowing it to seed any of
  // ADMIN / SUPER_ADMIN / STAFF_* would be a privilege-escalation vector.
  const metaRole = data.public_metadata?.role;
  const unsafeRole = data.unsafe_metadata?.role;

  let role: Role;
  if (metaRole && VALID_ROLES.has(metaRole as Role)) {
    role = metaRole as Role;
  } else if (
    type === 'user.created' &&
    unsafeRole &&
    SELF_PROMOTABLE_ROLES.has(unsafeRole as Role)
  ) {
    role = unsafeRole as Role;
    // Promote into publicMetadata so the JWT/middleware see it from now on.
    // Idempotent: if Clerk re-fires the webhook, this rewrites the same value.
    try {
      const client = await clerkClient();
      await client.users.updateUserMetadata(data.id, {
        publicMetadata: { role },
      });
    } catch (e) {
      console.error('Failed to promote unsafe_metadata.role to publicMetadata', e);
      // Fall through — the Prisma sync below still records the right role.
    }
  } else {
    role = 'CANDIDATE';
  }

  const metaLang = data.public_metadata?.lang;
  const lang: Language =
    metaLang === 'EN' || metaLang === 'MG' ? (metaLang as Language) : 'FR';

  await prisma.user.upsert({
    where: { clerkId: data.id },
    create: { clerkId: data.id, email: primaryEmail, role, lang },
    update: { email: primaryEmail, role, lang },
  });

  return NextResponse.json({ status: 'ok' });
}
