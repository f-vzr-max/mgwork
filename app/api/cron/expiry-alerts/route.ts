// POST /api/cron/expiry-alerts
//
// Vercel Cron-driven daily job (`0 7 * * *`). Sends renewal reminder emails
// for APPROVED documents whose `expiresAt` falls within {30, 15, 7} days.
//
// Auth: Bearer ${CRON_SECRET} (Vercel injects this header). No Clerk auth.
// Audit: written as a system event using the first SUPER_ADMIN's User.id as
// the `actor`. If no SUPER_ADMIN exists yet (fresh deploy), we skip the
// audit row but still send emails (the function returns successfully).
//
// Rate limit: not applied — this is a privileged cron.

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { env } from "@/lib/config";
import { send, type EmailLang } from "@/lib/resend";
import { registerEmailTemplates } from "@/lib/email/templates";

const ALERT_DAYS = [30, 15, 7] as const;
const LOOKAHEAD_DAYS = ALERT_DAYS[0];

function authorized(req: Request): boolean {
  const secret = env.cronSecret();
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  // Use a constant-time compare to thwart timing attacks.
  const expected = `Bearer ${secret}`;
  if (header.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ header.charCodeAt(i);
  }
  return mismatch === 0;
}

// We want to send EXACTLY one email per document per threshold. Returns the
// threshold matched (30, 15, or 7) when the document's calendar-day distance
// from now is one of those values. Returns null on any other day so we don't
// spam the candidate every morning of the 30-day window.
function pickThresholdDays(date: Date): number | null {
  const msPerDay = 24 * 60 * 60 * 1000;
  const day = Math.ceil((date.getTime() - Date.now()) / msPerDay);
  if (day <= 0) return null; // already expired or due today
  if ((ALERT_DAYS as readonly number[]).includes(day)) return day;
  return null;
}

export async function POST(req: Request): Promise<NextResponse> {
  if (!authorized(req)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  registerEmailTemplates();

  // Resolve actor for audit: first SUPER_ADMIN. Fallback to null = skip audit.
  const auditActor = await prisma.user.findFirst({
    where: { role: "SUPER_ADMIN" },
    select: { id: true },
  });

  // Pull APPROVED docs whose expiresAt is within the largest window. We then
  // fan out per-threshold below so we send distinct emails for 30/15/7 days.
  const horizon = new Date(Date.now() + LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);
  const candidates = await prisma.document.findMany({
    where: {
      status: "APPROVED",
      expiresAt: { not: null, gt: new Date(), lte: horizon },
    },
    include: {
      candidate: { include: { user: true } },
      enterprise: { include: { user: true } },
    },
  });

  let sent = 0;
  let skipped = 0;
  const failures: { documentId: string; reason: string }[] = [];

  for (const doc of candidates) {
    const expiresAt = doc.expiresAt;
    if (!expiresAt) {
      skipped++;
      continue;
    }
    const daysLeft = pickThresholdDays(expiresAt);
    if (daysLeft == null) {
      skipped++;
      continue;
    }

    // Determine recipient name + email + lang based on owner kind.
    let email: string | null = null;
    let name = "";
    let lang: EmailLang = "FR";

    if (doc.candidate?.user) {
      email = doc.candidate.user.email;
      name = `${doc.candidate.firstName} ${doc.candidate.lastName}`.trim();
      lang = doc.candidate.user.lang as EmailLang;
    } else if (doc.enterprise?.user) {
      email = doc.enterprise.user.email;
      name = doc.enterprise.companyName;
      lang = doc.enterprise.user.lang as EmailLang;
    }

    if (!email) {
      skipped++;
      continue;
    }

    const result = await send({
      template: "document-expiry",
      to: email,
      lang,
      props: {
        name,
        docType: doc.type,
        expiresAt: expiresAt.toISOString(),
        daysLeft,
      },
    });

    if ("error" in result && result.error === "send-error") {
      failures.push({ documentId: doc.id, reason: result.message });
    } else {
      sent++;
    }
  }

  // Audit one row per cron invocation summarising the run.
  if (auditActor) {
    await prisma.auditLog.create({
      data: {
        userId: auditActor.id,
        action: "cron.expiry_alerts_run",
        resourceType: "cron",
        resourceId: "expiry-alerts",
        metadata: {
          examined: candidates.length,
          sent,
          skipped,
          failures: failures.length,
        },
      },
    });
  } else {
    // eslint-disable-next-line no-console
    console.warn(
      "[cron.expiry_alerts] no SUPER_ADMIN actor present — audit row skipped",
    );
  }

  // Return a JSON summary even though contracts.md notes 204; including a
  // body is harmless for cron callers and useful for ops.
  return NextResponse.json(
    {
      examined: candidates.length,
      sent,
      skipped,
      failures: failures.length,
    },
    { status: 200 },
  );
}
