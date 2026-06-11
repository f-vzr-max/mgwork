// MG Work — Monthly enterprise report cron (M7).
//
// Vercel Cron handler. Auth via `Authorization: Bearer ${CRON_SECRET}`.
//
// For every Enterprise that has at least one DEPLOYED candidate, this cron:
//   1. Gathers the deployed staff list with each Application's recent
//      checkpoints + alert counts.
//   2. Asks Claude (fast tier, one-shot smart escalation) for a short,
//      neutral status summary.
//   3. Emails the contact via lib/resend.ts using the `monthly-report` template.
//   4. Audits a single `cron.monthly_report_run` event under a system actor.
//
// Returns 200 with a JSON summary so Francky can hit the URL by hand to smoke.

import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/config";
import { logAudit } from "@/lib/audit";
import { chatWithEscalation } from "@/lib/claude";
import { send } from "@/lib/resend";

type Summary = {
  enterprisesScanned: number;
  reportsSent: number;
  emailsSkipped: number;
  llmFailures: number;
  llmEscalations: number;
};

function authorized(req: Request): boolean {
  const expected = env.cronSecret();
  if (!expected) return false;
  const got = req.headers.get("authorization") ?? "";
  return got === `Bearer ${expected}`;
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const summary: Summary = {
    enterprisesScanned: 0,
    reportsSent: 0,
    emailsSkipped: 0,
    llmFailures: 0,
    llmEscalations: 0,
  };

  const enterprises = await prisma.enterprise.findMany({
    where: {
      jobOffers: {
        some: {
          applications: {
            some: { status: "DEPLOYED" },
          },
        },
      },
    },
    select: {
      id: true,
      companyName: true,
      contactName: true,
      user: { select: { email: true, lang: true } },
      jobOffers: {
        select: {
          id: true,
          title: true,
          applications: {
            where: { status: "DEPLOYED" },
            select: {
              id: true,
              status: true,
              candidate: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
              checkpoints: {
                orderBy: { date: "desc" },
                take: 5,
                select: {
                  date: true,
                  status: true,
                  notes: true,
                },
              },
            },
          },
        },
      },
    },
  });

  summary.enterprisesScanned = enterprises.length;

  for (const ent of enterprises) {
    const deployedRows = ent.jobOffers.flatMap((o) =>
      o.applications.map((a) => ({
        offerTitle: o.title,
        applicationId: a.id,
        candidate: a.candidate,
        checkpoints: a.checkpoints,
        alertCount: a.checkpoints.filter((c) => c.status !== "OK").length,
      })),
    );
    if (deployedRows.length === 0) continue;

    const factSheet = deployedRows
      .map(
        (r) =>
          `- ${r.candidate.firstName} ${r.candidate.lastName} (${r.offerTitle}) — ${r.alertCount} recent alert(s); last checkpoints: ${r.checkpoints
            .map((c) => `${c.date.toISOString().slice(0, 10)} ${c.status}`)
            .join(", ")}`,
      )
      .join("\n");

    const lang = ent.user.lang;
    const llm = await chatWithEscalation({
      system: buildSystemPrompt(lang),
      messages: [
        {
          role: "user",
          content: `Company: ${ent.companyName}\nDeployed staff:\n${factSheet}\n\nProduce the summary.`,
        },
      ],
      maxTokens: 800,
    });
    if (llm.escalated) summary.llmEscalations += 1;

    let summaryText: string;
    if ("error" in llm) {
      summary.llmFailures += 1;
      summaryText = buildFallbackSummary(deployedRows, lang);
    } else {
      summaryText = llm.text.trim() || buildFallbackSummary(deployedRows, lang);
    }

    if (!ent.user.email) {
      summary.emailsSkipped += 1;
      continue;
    }

    const result = await send({
      template: "monthly-report",
      to: ent.user.email,
      lang,
      props: {
        companyName: ent.companyName,
        contactName: ent.contactName ?? "",
        deployedCount: deployedRows.length,
        alertCount: deployedRows.reduce((n, r) => n + r.alertCount, 0),
        summaryText,
        rows: deployedRows.map((r) => ({
          candidateName: `${r.candidate.firstName} ${r.candidate.lastName}`,
          offerTitle: r.offerTitle,
          alertCount: r.alertCount,
        })),
      },
    });
    if ("error" in result && result.error === "send-error") {
      summary.emailsSkipped += 1;
    } else {
      summary.reportsSent += 1;
    }
  }

  const sysActor = await prisma.user.findFirst({
    where: { role: "SUPER_ADMIN" },
    select: { id: true },
  });
  if (sysActor) {
    await logAudit({
      userId: sysActor.id,
      action: "cron.monthly_report_run",
      resourceType: "cron",
      metadata: summary as unknown as Prisma.InputJsonValue,
    });
  }

  return NextResponse.json(summary, { status: 200 });
}

function buildSystemPrompt(lang: "FR" | "EN" | "MG"): string {
  const tone =
    "Be neutral, concise, and factual. 4-6 short bullets. No hedging.";
  if (lang === "EN") {
    return `You write monthly status summaries for an enterprise client about their deployed Madagascan staff in Mauritius. ${tone} Return plain text in English.`;
  }
  if (lang === "MG") {
    return `Manoratra famintinana isam-bolana momba ny mpiasa naparitaka any Maorisy ianao. ${tone} Mamaly amin'ny teny malagasy.`;
  }
  return `Tu rédiges des résumés mensuels pour un client entreprise sur ses collaborateurs malgaches déployés à Maurice. ${tone} Réponds en français.`;
}

function buildFallbackSummary(
  rows: Array<{
    candidate: { firstName: string; lastName: string };
    offerTitle: string;
    alertCount: number;
  }>,
  lang: "FR" | "EN" | "MG",
): string {
  const total = rows.length;
  const alerts = rows.reduce((n, r) => n + r.alertCount, 0);
  if (lang === "EN") {
    return `${total} staff deployed; ${alerts} recent alert(s) across the cohort.`;
  }
  if (lang === "MG") {
    return `${total} mpiasa miasa; ${alerts} fampitandremana vao haingana.`;
  }
  return `${total} collaborateur(s) déployé(s) ; ${alerts} alerte(s) récente(s) sur la cohorte.`;
}
