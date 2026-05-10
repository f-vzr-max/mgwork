// MG Work — Monthly check-in cron (M7).
//
// Vercel Cron handler. Auth via `Authorization: Bearer ${CRON_SECRET}`.
//
// Behaviour, per `Application` with status=DEPLOYED:
//   1. Find latest `CheckinPing`. If none, or sentAt > 30 days ago, send a
//      check-in via in-app conversation (write to Conversation history),
//      then create a new `CheckinPing` row.
//   2. For any prior CheckinPing whose sentAt > 48h ago AND respondedAt is null,
//      create a `Checkpoint` with status=ALERT (idempotent — only emit once
//      per ping by checking interventionLog tag).
//
// Audit: `cron.monthly_checkin_run` keyed to the first SUPER_ADMIN we find;
// if no SUPER_ADMIN exists, the audit is silently skipped (avoids a hard
// dependency on seeding).
//
// Returns 200 with a JSON summary so it's easy to trigger manually for smoke.

import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/config";
import { logAudit } from "@/lib/audit";

type Summary = {
  pingsSent: number;
  alertsRaised: number;
  applicationsScanned: number;
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

function authorized(req: Request): boolean {
  const expected = env.cronSecret();
  if (!expected) return false;
  const got = req.headers.get("authorization") ?? "";
  // Constant-ish-time compare: ok in JS for short tokens; the bearer length
  // alone leaks no useful info because the secret length is fixed by config.
  return got === `Bearer ${expected}`;
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const summary: Summary = {
    pingsSent: 0,
    alertsRaised: 0,
    applicationsScanned: 0,
  };

  // Pull all DEPLOYED applications with the candidate / latest ping context.
  const deployed = await prisma.application.findMany({
    where: { status: "DEPLOYED" },
    select: {
      id: true,
      candidateId: true,
      candidate: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          user: { select: { lang: true } },
        },
      },
      checkinPings: {
        orderBy: { sentAt: "desc" },
        take: 1,
        select: {
          id: true,
          sentAt: true,
          respondedAt: true,
        },
      },
    },
  });

  summary.applicationsScanned = deployed.length;
  const now = Date.now();

  for (const app of deployed) {
    const lastPing = app.checkinPings[0];
    const needsNewPing =
      !lastPing || now - lastPing.sentAt.getTime() > THIRTY_DAYS_MS;

    // 1) Send check-in via in-app conversation if due.
    if (needsNewPing) {
      const message = buildCheckinText(app.candidate.user.lang);
      await appendInAppMessage(app.candidate.id, message);

      await prisma.checkinPing.create({
        data: {
          applicationId: app.id,
          // sentAt defaults to now()
        },
      });
      summary.pingsSent += 1;
    }

    // 2) Raise ALERT for the latest unresponded ping older than 48h, if no
    //    alert checkpoint already exists for that ping.
    if (
      lastPing &&
      lastPing.respondedAt === null &&
      now - lastPing.sentAt.getTime() > FORTY_EIGHT_HOURS_MS
    ) {
      const tag = `checkin-ping:${lastPing.id}`;
      const exists = await prisma.checkpoint.findFirst({
        where: {
          applicationId: app.id,
          interventionLog: { contains: tag },
        },
        select: { id: true },
      });
      if (!exists) {
        await prisma.checkpoint.create({
          data: {
            applicationId: app.id,
            candidateId: app.candidateId,
            status: "ALERT",
            notes:
              "No response to monthly check-in within 48h. Auto-raised by cron.",
            interventionLog: tag,
          },
        });
        summary.alertsRaised += 1;
      }
    }
  }

  // Best-effort audit log under a system actor (first SUPER_ADMIN).
  const sysActor = await prisma.user.findFirst({
    where: { role: "SUPER_ADMIN" },
    select: { id: true },
  });
  if (sysActor) {
    await logAudit({
      userId: sysActor.id,
      action: "cron.monthly_checkin_run",
      resourceType: "cron",
      metadata: summary as unknown as Prisma.InputJsonValue,
    });
  }

  return NextResponse.json(summary, { status: 200 });
}

// Plain-text check-in body, localised. Keep tiny to avoid loud notifications.
function buildCheckinText(lang: "FR" | "EN" | "MG"): string {
  if (lang === "EN") {
    return "Hi! How are you doing this month? Any issues we should know about? Reply at any time.";
  }
  if (lang === "MG") {
    return "Manao ahoana! Manao ahoana ny fiainanao tamin'ity volana ity? Mamaly amin'ny fotoana tianao.";
  }
  // FR default
  return "Bonjour ! Comment ça se passe ce mois-ci ? Y a-t-il quoi que ce soit dont nous devrions être informés ? Répondez quand vous voulez.";
}

// Append a system message to the candidate's IN_APP conversation, creating it
// if needed. We deliberately don't use lib/social/in-app-adapter here — the
// adapter is built around inbound + SSE outbound, not server-originated pings.
async function appendInAppMessage(
  candidateId: string,
  text: string,
): Promise<void> {
  const now = new Date().toISOString();
  const newMessage = {
    role: "assistant" as const,
    text,
    at: now,
  };

  // Use upsert to handle the unique (candidateId, platform) constraint.
  const existing = await prisma.conversation.findUnique({
    where: {
      candidateId_platform: { candidateId, platform: "IN_APP" },
    },
    select: { id: true, history: true },
  });

  if (existing) {
    const prevHistory = Array.isArray(existing.history) ? existing.history : [];
    await prisma.conversation.update({
      where: { id: existing.id },
      data: {
        history: [...prevHistory, newMessage] as unknown as Prisma.InputJsonValue,
      },
    });
  } else {
    await prisma.conversation.create({
      data: {
        candidateId,
        platform: "IN_APP",
        history: [newMessage] as unknown as Prisma.InputJsonValue,
      },
    });
  }
}
