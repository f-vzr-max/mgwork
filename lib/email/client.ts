import { env } from "../config";

// Transactional email transport (Brevo) + a lazy template registry. Templates
// render to HTML on demand; `lib/email/templates.ts` wires the React-Email
// components in via `registerTemplate`. Sends no-op (and log) when BREVO_API_KEY
// is absent so dev/preview don't fail without a key.

export const EMAIL_TEMPLATES = [
  "welcome",
  "document-expiry",
  "document-approved",
  "document-rejected",
  "interview-scheduled",
  "monthly-report",
  "invoice-issued",
  "deletion-request",
] as const;

export type EmailTemplate = (typeof EMAIL_TEMPLATES)[number];
export type EmailLang = "FR" | "EN" | "MG";

export type SendParams<P extends Record<string, unknown> = Record<string, unknown>> = {
  template: EmailTemplate;
  to: string | string[];
  props: P;
  lang?: EmailLang;
  subject?: string;
  replyTo?: string;
};

export type SendResult =
  | { error: "no-key"; logged: true }
  | { error: "send-error"; message: string }
  | { id: string };

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

// Brevo wants sender as { name, email }; our config stores "Name <email>".
function parseSender(from: string): { email: string; name?: string } {
  const m = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1] || undefined, email: m[2] };
  return { email: from.trim() };
}

type Renderer = (props: Record<string, unknown>, lang: EmailLang) => Promise<{ subject: string; html: string }>;

const renderers = new Map<EmailTemplate, Renderer>();

export function registerTemplate(name: EmailTemplate, renderer: Renderer): void {
  renderers.set(name, renderer);
}

// DPO notice for a GDPR Art.17 deletion request. The durable record is the
// auditLog row; this email is a best-effort heads-up to the data-protection
// officer.
registerTemplate("deletion-request", async (props) => ({
  subject: "[AsanaoConnect] Demande de suppression de compte (RGPD)",
  html: `<p>Une demande de suppression de compte a été reçue.</p>
<ul>
<li>User id: <code>${props.userId ?? "?"}</code></li>
<li>Email: <code>${props.email ?? "?"}</code></li>
<li>Reçue le: ${props.requestedAt ?? new Date().toISOString()}</li>
</ul>`,
}));

async function renderTemplate(
  template: EmailTemplate,
  props: Record<string, unknown>,
  lang: EmailLang,
): Promise<{ subject: string; html: string }> {
  const renderer = renderers.get(template);
  if (renderer) return renderer(props, lang);
  return {
    subject: `[AsanaoConnect] ${template}`,
    html: `<p>Template <code>${template}</code> not yet implemented (${lang}).</p>`,
  };
}

export async function send<P extends Record<string, unknown>>(params: SendParams<P>): Promise<SendResult> {
  const lang: EmailLang = params.lang ?? "FR";
  const key = env.brevoKey();
  const { subject, html } = await renderTemplate(params.template, params.props, lang);
  const finalSubject = params.subject ?? subject;
  const recipients = Array.isArray(params.to) ? params.to : [params.to];

  if (!key) {
    // eslint-disable-next-line no-console
    console.log("[email:noop]", { template: params.template, to: recipients, lang, subject: finalSubject });
    return { error: "no-key", logged: true };
  }

  try {
    const res = await fetch(BREVO_ENDPOINT, {
      method: "POST",
      headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: parseSender(env.emailFrom()),
        to: recipients.map((email) => ({ email })),
        subject: finalSubject,
        htmlContent: html,
        ...(params.replyTo ? { replyTo: { email: params.replyTo } } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { error: "send-error", message: `brevo ${res.status}: ${body.slice(0, 200)}` };
    }
    const data = (await res.json().catch(() => ({}))) as { messageId?: string };
    return { id: data.messageId ?? "" };
  } catch (err) {
    return { error: "send-error", message: err instanceof Error ? err.message : String(err) };
  }
}
