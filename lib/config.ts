// Centralized environment-variable access. Per project rules, no other file
// in the codebase should reach into `process.env` directly — import from here.
// All getters are safe to call when the variable is missing; consumers decide
// how to degrade.

type Maybe = string | undefined;

function read(name: string): Maybe {
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
}

export const env = {
  // Anthropic
  anthropicKey: () => read("ANTHROPIC_API_KEY"),

  // Supabase
  supabaseUrl: () => read("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: () => read("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseServiceKey: () => read("SUPABASE_SERVICE_ROLE_KEY"),

  // Resend
  resendKey: () => read("RESEND_API_KEY"),
  resendFrom: () => read("RESEND_FROM_EMAIL") ?? "MG Work <noreply@mgwork.io>",

  // Clerk (server-side reads only)
  clerkSecret: () => read("CLERK_SECRET_KEY"),
  clerkWebhookSecret: () => read("CLERK_WEBHOOK_SECRET"),
  cronSecret: () => read("CRON_SECRET"),

  // App
  appUrl: () => read("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000",
  nodeEnv: () => read("NODE_ENV") ?? "development",

  // Meta / WhatsApp (M6 will use; declared here so M1 owns env access)
  metaAppId: () => read("META_APP_ID"),
  metaAppSecret: () => read("META_APP_SECRET"),
  metaWebhookVerifyToken: () => read("META_WEBHOOK_VERIFY_TOKEN"),
  whatsappPhoneNumberId: () => read("WHATSAPP_PHONE_NUMBER_ID"),
  whatsappAccessToken: () => read("WHATSAPP_ACCESS_TOKEN"),

  // Sentry (M13 — observability). All optional; absence triggers no-op init so
  // local dev stays clean. SENTRY_AUTH_TOKEN is build-time only (used by
  // withSentryConfig to upload source maps from CI).
  sentryDsn: () => read("SENTRY_DSN"),
  sentryAuthToken: () => read("SENTRY_AUTH_TOKEN"),
  sentryOrg: () => read("SENTRY_ORG"),
  sentryProject: () => read("SENTRY_PROJECT"),
} as const;

export function isProd(): boolean {
  return env.nodeEnv() === "production";
}

export function isDev(): boolean {
  return env.nodeEnv() !== "production";
}
