// Sentry edge runtime initialization (middleware, edge routes).
// No-op when SENTRY_DSN is absent.
import * as Sentry from "@sentry/nextjs";
import { env } from "@/lib/config";

const dsn = env.sentryDsn();

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    environment: env.nodeEnv(),
  });
}
