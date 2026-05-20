// Live-site audit driver. Headless Chromium navigates each route, captures
// console messages, network failures, and final URL after any redirect. Emits
// one JSON line per route to stdout (NDJSON). Intended for one-shot use; not
// committed to CI.
//
// Usage:
//   node scripts/audit-live.mjs > /tmp/audit.ndjson

import { chromium } from "playwright";

const BASE = "https://mgwork-seven.vercel.app";

const ROUTES = [
  { path: "/", kind: "public", expect: "200" },
  { path: "/sign-in", kind: "public", expect: "200" },
  { path: "/sign-up", kind: "public", expect: "200" },
  { path: "/dashboard", kind: "protected", expect: "redirect-to-sign-in" },
  { path: "/onboarding", kind: "protected", expect: "redirect-to-sign-in" },
  { path: "/candidate", kind: "protected", expect: "redirect-to-sign-in" },
  { path: "/enterprise", kind: "protected", expect: "redirect-to-sign-in" },
  { path: "/admin", kind: "protected", expect: "redirect-to-sign-in" },
  { path: "/staff", kind: "protected", expect: "redirect-to-sign-in" },
  { path: "/this-route-does-not-exist", kind: "negative", expect: "404" },
  { path: "/candidats", kind: "negative", expect: "404 (new-design route, not in prod)" },
];

const NAV_TIMEOUT_MS = 30_000;
const SETTLE_MS = 2_000;

async function auditOne(context, route) {
  const page = await context.newPage();
  const consoleMessages = [];
  const pageErrors = [];
  const requests = [];
  const failedRequests = [];

  page.on("console", (msg) => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text(),
      location: msg.location(),
    });
  });
  page.on("pageerror", (err) => {
    pageErrors.push({ message: err.message, stack: err.stack ?? null });
  });
  page.on("request", (req) => {
    requests.push({ url: req.url(), method: req.method(), resourceType: req.resourceType() });
  });
  page.on("requestfailed", (req) => {
    failedRequests.push({
      url: req.url(),
      method: req.method(),
      failure: req.failure()?.errorText ?? "unknown",
      resourceType: req.resourceType(),
    });
  });
  page.on("response", (res) => {
    const status = res.status();
    if (status >= 400) {
      failedRequests.push({
        url: res.url(),
        method: res.request().method(),
        status,
        resourceType: res.request().resourceType(),
      });
    }
  });

  const url = BASE + route.path;
  const t0 = Date.now();
  let docStatus = null;
  let docOk = null;
  let navError = null;

  try {
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
    if (response) {
      docStatus = response.status();
      docOk = response.ok();
    }
  } catch (err) {
    navError = err.message;
  }

  // settle
  await page.waitForTimeout(SETTLE_MS);

  const finalUrl = page.url();
  const title = await page.title().catch(() => null);

  // Detect Clerk widget presence — used to verify sign-in / sign-up pages
  let clerkPresent = false;
  try {
    clerkPresent =
      (await page.locator(".cl-rootBox, [data-clerk-component]").count()) > 0 ||
      (await page.locator("text=Clerk").count()) > 0;
  } catch {}

  // Detect simple page identity markers
  const has = {
    h1: (await page.locator("h1").count()) > 0,
    main: (await page.locator("main").count()) > 0,
    footer: (await page.locator("footer").count()) > 0,
    signInRoute: /\/sign-in/.test(finalUrl),
    notFoundCopy: (await page.locator("text=/404|not found|introuvable/i").count()) > 0,
  };

  const errors = consoleMessages.filter((m) => m.type === "error");
  const warnings = consoleMessages.filter((m) => m.type === "warning");

  await page.close();

  return {
    path: route.path,
    expect: route.expect,
    kind: route.kind,
    finalUrl,
    docStatus,
    docOk,
    navError,
    durationMs: Date.now() - t0,
    title,
    has,
    clerkPresent,
    counts: {
      requests: requests.length,
      failedRequests: failedRequests.length,
      consoleErrors: errors.length,
      consoleWarnings: warnings.length,
      pageErrors: pageErrors.length,
    },
    errors,
    warnings,
    pageErrors,
    failedRequests,
  };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
    viewport: { width: 1440, height: 900 },
    locale: "fr-FR",
  });

  for (const route of ROUTES) {
    const result = await auditOne(context, route);
    process.stdout.write(JSON.stringify(result) + "\n");
  }

  await browser.close();
})().catch((err) => {
  console.error("AUDIT_FATAL", err);
  process.exit(1);
});
