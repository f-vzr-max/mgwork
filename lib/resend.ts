import { Resend } from "resend";
import { env } from "./config";

// All known templates. Add new ones here as M10 templates land.
export const EMAIL_TEMPLATES = [
  "welcome",
  "document-expiry",
  "document-approved",
  "document-rejected",
  "interview-scheduled",
  "monthly-report",
  "invoice-issued",
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

let cached: Resend | null | undefined;

function client(): Resend | null {
  if (cached !== undefined) return cached;
  const key = env.resendKey();
  cached = key ? new Resend(key) : null;
  return cached;
}

// Reset the cached client. Test-only.
export function _resetResendClient(): void {
  cached = undefined;
}

// Templates render to HTML lazily. M10 ships the React-Email components and
// registers them via `registerTemplate`. Until then, missing templates
// fall back to a plain placeholder so envelopes still send in dev/preview.
type Renderer = (props: Record<string, unknown>, lang: EmailLang) => Promise<{ subject: string; html: string }>;

const renderers = new Map<EmailTemplate, Renderer>();

export function registerTemplate(name: EmailTemplate, renderer: Renderer): void {
  renderers.set(name, renderer);
}

async function renderTemplate(
  template: EmailTemplate,
  props: Record<string, unknown>,
  lang: EmailLang,
): Promise<{ subject: string; html: string }> {
  const renderer = renderers.get(template);
  if (renderer) return renderer(props, lang);
  // Placeholder body — keeps `send()` callable before M10 lands.
  return {
    subject: `[MG Work] ${template}`,
    html: `<p>Template <code>${template}</code> not yet implemented (${lang}).</p>`,
  };
}

// Send an email. Returns a no-op + console.log when RESEND_API_KEY is absent
// so dev environments don't fail without a key.
export async function send<P extends Record<string, unknown>>(params: SendParams<P>): Promise<SendResult> {
  const lang: EmailLang = params.lang ?? "FR";
  const c = client();
  const { subject, html } = await renderTemplate(params.template, params.props, lang);
  const finalSubject = params.subject ?? subject;
  const recipients = Array.isArray(params.to) ? params.to : [params.to];

  if (!c) {
    // eslint-disable-next-line no-console
    console.log("[resend:noop]", {
      template: params.template,
      to: recipients,
      lang,
      subject: finalSubject,
    });
    return { error: "no-key", logged: true };
  }

  try {
    const result = await c.emails.send({
      from: env.resendFrom(),
      to: recipients,
      subject: finalSubject,
      html,
      replyTo: params.replyTo,
    });
    if (result.error) {
      return { error: "send-error", message: result.error.message };
    }
    return { id: result.data?.id ?? "" };
  } catch (err) {
    return { error: "send-error", message: err instanceof Error ? err.message : String(err) };
  }
}
