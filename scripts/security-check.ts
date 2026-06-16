/* eslint-disable no-console */
//
// security-check.ts
// -----------------
// CLI tool: greps the codebase for security anti-patterns and exits non-zero
// when one is found. Wired to `npm run security:check` (see package.json).
//
// Run with: `tsx scripts/security-check.ts` or `ts-node scripts/security-check.ts`.
//
// Rules
//   FAIL:
//     1. Mutation API handlers (POST/PUT/PATCH/DELETE) missing `auth(` call.
//     2. Mutation handlers missing `logAudit(` call.
//     3. `process.env.` referenced outside `lib/`.
//     4. `prisma.$queryRaw` anywhere (flag for review).
//     5. `SUPABASE_SERVICE_ROLE_KEY` imported/referenced outside `lib/supabase.ts`.
//   WARN:
//     - zod object schema not using `.strict()`.
//
// Implementation notes:
//   - We deliberately read-only-grep the source tree so this is safe to run
//     in CI without any dependencies on the Prisma client or DB.
//   - We avoid third-party glob libs to keep the script dep-free; Node fs is
//     enough for a project of this size.
//

import { promises as fs } from "fs";
import * as path from "path";

// Resolve repo root from this file's location regardless of CJS/ESM.
// Falls back to cwd if neither __dirname nor import.meta.url are usable.
const REPO_ROOT = (() => {
  // CJS path
  if (typeof __dirname !== "undefined") {
    return path.resolve(__dirname, "..");
  }
  return path.resolve(process.cwd());
})();

const IGNORE_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "dist",
  "build",
  "coverage",
  ".turbo",
  ".vercel",
]);

type Finding = {
  level: "FAIL" | "WARN";
  rule: string;
  file: string;
  line: number;
  message: string;
};

const findings: Finding[] = [];

function rel(p: string): string {
  return path.relative(REPO_ROOT, p).split(path.sep).join("/");
}

async function* walk(dir: string): AsyncGenerator<string> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (IGNORE_DIRS.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      yield* walk(full);
    } else if (e.isFile()) {
      yield full;
    }
  }
}

function isTSFile(p: string): boolean {
  return /\.(ts|tsx)$/.test(p);
}

function isApiRouteFile(relPath: string): boolean {
  return /^app\/api\/.+\/route\.ts$/.test(relPath);
}

/**
 * Webhook handlers (e.g. Clerk, Meta) authenticate via signature verification
 * (svix, X-Hub-Signature). They do NOT use Clerk's `auth()` and that's by
 * design — exclude them from the auth/audit grep rules.
 */
function isWebhookRoute(relPath: string): boolean {
  return /^app\/api\/webhooks\//.test(relPath);
}

/**
 * Cron handlers authenticate via `Authorization: Bearer ${CRON_SECRET}` rather
 * than Clerk session cookies. They MUST still audit their work, but the
 * `auth()` rule does not apply.
 */
function isCronRoute(relPath: string): boolean {
  return /^app\/api\/cron\//.test(relPath);
}

function isInLibDir(relPath: string): boolean {
  return relPath.startsWith("lib/");
}

function isLibSupabaseFile(relPath: string): boolean {
  // Both `lib/supabase.ts` (creates the client) and `lib/config.ts` (centralized
  // env getters) must reference the literal env var name; that's the whole
  // point of centralizing it. Anywhere else is a leak.
  return relPath === "lib/supabase.ts" || relPath === "lib/config.ts";
}

function findLineNumber(haystack: string, needle: string): number {
  const idx = haystack.indexOf(needle);
  if (idx < 0) return 1;
  return haystack.slice(0, idx).split("\n").length;
}

// ---- Rule helpers --------------------------------------------------------

const MUTATION_VERBS = ["POST", "PUT", "PATCH", "DELETE"] as const;

/**
 * Returns the substring corresponding to the body of an exported mutation
 * handler, plus the offset, so we can grep within and report sane lines.
 * Naive brace-matching but sufficient for our handler style.
 */
function extractHandlerBodies(
  source: string,
): Array<{ verb: string; body: string; offset: number }> {
  const out: Array<{ verb: string; body: string; offset: number }> = [];
  for (const verb of MUTATION_VERBS) {
    const re = new RegExp(
      `export\\s+async\\s+function\\s+${verb}\\s*\\(`,
      "g",
    );
    let m: RegExpExecArray | null;
    while ((m = re.exec(source))) {
      // find the opening brace of the function body
      const openParen = m.index + m[0].length - 1;
      // find matching close paren of the args
      let depth = 1;
      let i = openParen + 1;
      while (i < source.length && depth > 0) {
        if (source[i] === "(") depth++;
        else if (source[i] === ")") depth--;
        i++;
      }
      // find opening brace
      while (i < source.length && source[i] !== "{") i++;
      if (i >= source.length) continue;
      const bodyStart = i + 1;
      depth = 1;
      i = bodyStart;
      while (i < source.length && depth > 0) {
        if (source[i] === "{") depth++;
        else if (source[i] === "}") depth--;
        i++;
      }
      const body = source.slice(bodyStart, i - 1);
      out.push({ verb, body, offset: bodyStart });
    }
  }
  return out;
}

function checkApiRoute(relPath: string, source: string) {
  // Webhook routes use signature verification instead of session auth.
  if (isWebhookRoute(relPath)) return;
  // Cron routes use a Bearer token (CRON_SECRET) check instead of Clerk auth.
  const skipAuthCheck = isCronRoute(relPath);

  for (const { verb, body, offset } of extractHandlerBodies(source)) {
    // `auth()` may be called directly OR via a wrapper helper (e.g.
    // `requireAdmin`, `requireOwner`) that we know internally calls auth().
    const authed =
      /\bauth\s*\(/.test(body) ||
      /\brequireAdmin\s*\(/.test(body) ||
      /\brequireOwner\s*\(/.test(body);
    if (!skipAuthCheck && !authed) {
      findings.push({
        level: "FAIL",
        rule: "missing-auth",
        file: relPath,
        line: source.slice(0, offset).split("\n").length,
        message: `${verb} handler does not call auth() — unauthenticated mutation.`,
      });
    }
    // Accept any of the `logAudit(...)` family helpers (e.g. logAudit,
    // logAuditByClerkId) or a direct `prisma.auditLog.create` /
    // `tx.auditLog.create` call as evidence that the mutation is audited.
    const audited =
      /\blogAudit\w*\s*\(/.test(body) ||
      /\bauditLog\.create\s*\(/.test(body) ||
      // unlinkChannelIdentity audits internally (lib/social/identity.ts).
      // matches the literal call; a comment naming the fn without '(' won't false-pass.
      /\bunlinkChannelIdentity\s*\(/.test(body);
    // Onboarding drafts are routine save-state, not security-relevant (see the
    // route header comment). Exempt from the audit rule by name.
    const auditExempt = relPath === "app/api/onboarding/draft/route.ts";
    if (!audited && !auditExempt) {
      findings.push({
        level: "FAIL",
        rule: "missing-audit",
        file: relPath,
        line: source.slice(0, offset).split("\n").length,
        message: `${verb} handler does not call logAudit() / auditLog.create() — mutation not audited.`,
      });
    }
  }
}

// Mutation handlers must throttle abuse via rateLimit(). Body-scoped: a route
// with rateLimit on one verb but not another IS flagged. Webhooks (signature
// auth) and crons (Bearer token + low external reach) are exempt by prefix.
function checkMissingRateLimit(relPath: string, source: string) {
  if (isWebhookRoute(relPath) || isCronRoute(relPath)) return;
  for (const { verb, body, offset } of extractHandlerBodies(source)) {
    if (/\brateLimit\s*\(/.test(body)) continue;
    findings.push({
      level: "FAIL",
      rule: "missing-ratelimit",
      file: relPath,
      line: source.slice(0, offset).split("\n").length,
      message: `${verb} handler does not call rateLimit() — mutation not throttled.`,
    });
  }
}

function checkProcessEnv(relPath: string, source: string) {
  if (isInLibDir(relPath)) return;
  // Tooling config files (jest.config.ts, playwright.config.ts, next.config.ts,
  // sentry.*.config.ts, postcss.config.ts, tailwind.config.ts) live at repo
  // root and run before any `lib/config` is loaded. They legitimately read
  // env vars to configure the test/build harness.
  if (/^[a-zA-Z0-9.-]+\.config\.ts$/.test(relPath)) return;
  // instrumentation.ts runs at cold-start before lib/config is loadable; it
  // must read NEXT_RUNTIME/Sentry env directly. File-scoped on purpose — not a
  // codebase-wide NEXT_RUNTIME exemption.
  if (relPath === "instrumentation.ts") return;
  // Test files seed mock env; the named dev script is never deployed. Narrow
  // by design — not a blanket scripts/ exemption (a shipped script could leak).
  if (/\.test\.tsx?$/.test(relPath)) return;
  if (relPath === "scripts/fix-test-user-role.ts") return;
  // ignore comments-only matches by skipping leading "//" or "*"
  const lines = source.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(\/\/|\*)/.test(line)) continue;
    if (/process\.env\./.test(line)) {
      findings.push({
        level: "FAIL",
        rule: "process-env-outside-lib",
        file: relPath,
        line: i + 1,
        message: "process.env.* referenced outside lib/ — centralize config.",
      });
    }
  }
}

function checkQueryRaw(relPath: string, source: string) {
  const idx = source.indexOf("$queryRaw");
  if (idx >= 0) {
    findings.push({
      level: "FAIL",
      rule: "raw-sql",
      file: relPath,
      line: findLineNumber(source, "$queryRaw"),
      message: "prisma.$queryRaw used — flagged for security review.",
    });
  }
}

function checkServiceRoleKey(relPath: string, source: string) {
  if (isLibSupabaseFile(relPath)) return;
  if (source.includes("SUPABASE_SERVICE_ROLE_KEY")) {
    findings.push({
      level: "FAIL",
      rule: "service-role-key-leak",
      file: relPath,
      line: findLineNumber(source, "SUPABASE_SERVICE_ROLE_KEY"),
      message:
        "SUPABASE_SERVICE_ROLE_KEY referenced outside lib/supabase.ts — service role must not leak.",
    });
  }
}

function checkZodStrict(relPath: string, source: string) {
  // Only lint files that import zod
  if (!/from\s+["']zod["']/.test(source)) return;
  // Find every `z.object({...})` and warn if not followed by `.strict(`
  const re = /z\.object\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    // find matching ) of the object call
    let depth = 1;
    let i = m.index + m[0].length;
    while (i < source.length && depth > 0) {
      if (source[i] === "(") depth++;
      else if (source[i] === ")") depth--;
      i++;
    }
    // examine the next ~30 chars for .strict(
    const tail = source.slice(i, i + 30);
    if (!/^\s*\.strict\s*\(/.test(tail)) {
      findings.push({
        level: "WARN",
        rule: "zod-not-strict",
        file: relPath,
        line: source.slice(0, m.index).split("\n").length,
        message: "z.object({...}) without .strict() — extra fields may be accepted.",
      });
    }
  }
}

// ---- Main ---------------------------------------------------------------

async function main() {
  for await (const abs of walk(REPO_ROOT)) {
    if (!isTSFile(abs)) continue;
    const r = rel(abs);
    // skip the security-check script itself + scripts dir to avoid self-flagging
    if (r === "scripts/security-check.ts") continue;
    const source = await fs.readFile(abs, "utf8");

    if (isApiRouteFile(r)) {
      checkApiRoute(r, source);
      checkMissingRateLimit(r, source);
    }
    checkProcessEnv(r, source);
    checkQueryRaw(r, source);
    checkServiceRoleKey(r, source);
    checkZodStrict(r, source);
  }

  const fails = findings.filter((f) => f.level === "FAIL");
  const warns = findings.filter((f) => f.level === "WARN");

  if (warns.length > 0) {
    console.warn(`\n[security-check] ${warns.length} warning(s):`);
    for (const f of warns) {
      console.warn(`  WARN  ${f.file}:${f.line}  [${f.rule}]  ${f.message}`);
    }
  }

  if (fails.length > 0) {
    console.error(`\n[security-check] ${fails.length} failure(s):`);
    for (const f of fails) {
      console.error(`  FAIL  ${f.file}:${f.line}  [${f.rule}]  ${f.message}`);
    }
    console.error("\n[security-check] FAILED");
    process.exit(1);
  }

  console.log(
    `[security-check] OK (${warns.length} warning(s), 0 failures)`,
  );
}

// Only run the CLI when invoked directly (tsx scripts/security-check.ts), not
// when imported by the unit test. require.main holds under both tsx and ts-jest.
if (typeof require !== "undefined" && require.main === module) {
  main().catch((err) => {
    console.error("[security-check] crashed:", err);
    process.exit(2);
  });
}

export const _test = {
  checkApiRoute,
  checkMissingRateLimit,
  findings,
  reset: () => {
    findings.length = 0;
  },
};
