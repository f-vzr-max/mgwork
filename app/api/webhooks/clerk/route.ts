import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { Webhook } from 'svix';
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

  const metaRole = data.public_metadata?.role;
  const role: Role =
    metaRole && VALID_ROLES.has(metaRole as Role)
      ? (metaRole as Role)
      : 'CANDIDATE';

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
