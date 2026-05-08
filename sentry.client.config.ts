// Sentry client-side initialization (browser bundle).
// No-op when SENTRY_DSN is absent — keeps local dev quiet and avoids any
// network calls until Francky wires up a real DSN in the deployment env.
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
