// Email template registry.
//
// Maps template keys (declared in `lib/email/client.ts`) to React Email components,
// renders them to HTML, and registers each via `registerTemplate(...)` from
// `lib/email/client.ts`. Side-effecting on import: calling `registerEmailTemplates()`
// (idempotent) wires every template into the registry.
//
// Why a side-effecting init function rather than module-load registration?
//   - Tests / scripts that import `lib/email/client.ts` shouldn't have to pay the
//     cost of pulling React Email + every template eagerly.
//   - Server entry points (route handlers, cron) call this once, then use
//     `send({ template, ... })` from `lib/email/client.ts`.

import * as React from "react";
import { render } from "@react-email/components";

import { registerTemplate, type EmailLang, type EmailTemplate } from "./client";

import WelcomeEmail, { WelcomeEmailSubjects } from "@/emails/WelcomeEmail";
import DocumentExpiryEmail, {
  DocumentExpiryEmailSubjects,
} from "@/emails/DocumentExpiryEmail";
import DocumentApprovedEmail, {
  DocumentApprovedEmailSubjects,
} from "@/emails/DocumentApprovedEmail";
import DocumentRejectedEmail, {
  DocumentRejectedEmailSubjects,
} from "@/emails/DocumentRejectedEmail";
import InterviewScheduledEmail, {
  InterviewScheduledEmailSubjects,
} from "@/emails/InterviewScheduledEmail";
import MonthlyReportEmail, {
  MonthlyReportEmailSubjects,
} from "@/emails/MonthlyReportEmail";
import InvoiceIssuedEmail, {
  InvoiceIssuedEmailSubjects,
} from "@/emails/InvoiceIssuedEmail";

let registered = false;

// Render a React element to email-safe HTML. `@react-email/components.render`
// supports both sync and async usage; force the Promise-returning shape for
// uniformity.
async function toHtml(node: React.ReactElement): Promise<string> {
  const result = render(node);
  return result instanceof Promise ? await result : result;
}

function pick<T>(map: Record<EmailLang, T>, lang: EmailLang): T {
  return map[lang] ?? map.EN;
}

export function registerEmailTemplates(): void {
  if (registered) return;
  registered = true;

  registerTemplate("welcome", async (props, lang) => {
    const html = await toHtml(
      React.createElement(WelcomeEmail, {
        name: String(props.name ?? ""),
        lang,
      }),
    );
    return { subject: pick(WelcomeEmailSubjects, lang), html };
  });

  registerTemplate("document-expiry", async (props, lang) => {
    const days = Number(props.daysLeft ?? 0);
    const expiresAt = (props.expiresAt as Date | string | undefined) ?? new Date();
    const html = await toHtml(
      React.createElement(DocumentExpiryEmail, {
        name: String(props.name ?? ""),
        docType: String(props.docType ?? ""),
        expiresAt,
        daysLeft: days,
        lang,
      }),
    );
    return {
      subject: DocumentExpiryEmailSubjects(lang, days),
      html,
    };
  });

  registerTemplate("document-approved", async (props, lang) => {
    const html = await toHtml(
      React.createElement(DocumentApprovedEmail, {
        name: String(props.name ?? ""),
        docType: String(props.docType ?? ""),
        lang,
      }),
    );
    return { subject: pick(DocumentApprovedEmailSubjects, lang), html };
  });

  registerTemplate("document-rejected", async (props, lang) => {
    const html = await toHtml(
      React.createElement(DocumentRejectedEmail, {
        name: String(props.name ?? ""),
        docType: String(props.docType ?? ""),
        reason: String(props.reason ?? ""),
        lang,
      }),
    );
    return { subject: pick(DocumentRejectedEmailSubjects, lang), html };
  });

  registerTemplate("interview-scheduled", async (props, lang) => {
    const scheduledAt =
      (props.scheduledAt as Date | string | undefined) ?? new Date();
    const html = await toHtml(
      React.createElement(InterviewScheduledEmail, {
        name: String(props.name ?? ""),
        scheduledAt,
        type: String(props.type ?? ""),
        videoUrl: typeof props.videoUrl === "string" ? props.videoUrl : undefined,
        lang,
      }),
    );
    return { subject: pick(InterviewScheduledEmailSubjects, lang), html };
  });

  registerTemplate("monthly-report", async (props, lang) => {
    const summary = (props.summary ?? {
      period: "",
      activeOffers: 0,
      applications: 0,
      interviewsHeld: 0,
      deployments: 0,
    }) as {
      period: string;
      activeOffers: number;
      applications: number;
      interviewsHeld: number;
      deployments: number;
    };
    const html = await toHtml(
      React.createElement(MonthlyReportEmail, {
        enterpriseName: String(props.enterpriseName ?? ""),
        summary,
        lang,
      }),
    );
    return {
      subject: MonthlyReportEmailSubjects(lang, summary.period),
      html,
    };
  });

  registerTemplate("invoice-issued", async (props, lang) => {
    const dueAt = (props.dueAt as Date | string | undefined) ?? new Date();
    const html = await toHtml(
      React.createElement(InvoiceIssuedEmail, {
        enterpriseName: String(props.enterpriseName ?? ""),
        amount: Number(props.amount ?? 0),
        currency: String(props.currency ?? "MUR"),
        dueAt,
        lang,
      }),
    );
    return { subject: pick(InvoiceIssuedEmailSubjects, lang), html };
  });
}

// Test-only: reset the "already registered" flag.
export function _resetEmailTemplateRegistry(): void {
  registered = false;
}

// Re-export the canonical key list for callers that want compile-time checks.
export type RegisteredEmailTemplate = EmailTemplate;
