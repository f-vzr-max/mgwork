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
  resendFrom: () => read("RESEND_FROM_EMAIL") ?? "AsanaoConnect <noreply@mgwork.io>",

  // Clerk (server-side reads only)
  clerkSecret: () => read("CLERK_SECRET_KEY"),
  clerkWebhookSecret: () => read("CLERK_WEBHOOK_SECRET"),
  cronSecret: () => read("CRON_SECRET"),

  // App
  appUrl: () => read("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000",
  appUrlLegacy: () => read("APP_URL"),
  nodeEnv: () => read("NODE_ENV") ?? "development",

  // Vercel-injected deployment URLs (bare hosts; consumers add the scheme).
  vercelUrl: () => read("VERCEL_URL"),
  vercelBranchUrl: () => read("VERCEL_BRANCH_URL"),
  vercelProjectProductionUrl: () => read("VERCEL_PROJECT_PRODUCTION_URL"),

  // Upstash Redis REST (distributed rate limiting). Optional; absence falls
  // back to in-memory per-lambda limiting.
  upstashUrl: () => read("UPSTASH_REDIS_REST_URL"),
  upstashToken: () => read("UPSTASH_REDIS_REST_TOKEN"),

  // Meta / WhatsApp (M6 will use; declared here so M1 owns env access)
  metaAppId: () => read("META_APP_ID"),
  metaAppSecret: () => read("META_APP_SECRET"),
  metaWebhookVerifyToken: () => read("META_WEBHOOK_VERIFY_TOKEN"),
  whatsappPhoneNumberId: () => read("WHATSAPP_PHONE_NUMBER_ID"),
  whatsappAccessToken: () => read("WHATSAPP_ACCESS_TOKEN"),
  // Channels phase 0 — Messenger/Instagram outbound + deep links. All optional;
  // adapters degrade to stub mode (skipped sends, no deep links) when unset.
  metaPageAccessToken: () => read("META_PAGE_ACCESS_TOKEN"),
  metaPageId: () => read("META_PAGE_ID"),
  whatsappBusinessNumber: () => read("WHATSAPP_BUSINESS_NUMBER"),
  // Static read (not via read()) so Next inlines it into client bundles; gates
  // the channel-links card until Meta App Review completes.
  channelsEnabled: () => process.env.NEXT_PUBLIC_CHANNELS_ENABLED === "true",

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
