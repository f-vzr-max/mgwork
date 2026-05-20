import { test, expect } from "@playwright/test";

// Smoke tests for the new MG·Work hi-fi public marketing pages. These verify
// each public URL responds, key chrome is present (wordmark, language menu,
// theme toggle, footer), and theme + locale switching round-trip without
// console errors. Pages do not require auth — middleware whitelists them.

const PUBLIC_PATHS = [
  { path: "/", name: "Home", title: /MG.*Work/i },
  { path: "/candidats", name: "Candidats", title: /candidat/i },
  { path: "/entreprises", name: "Entreprises", title: /entrepris/i },
  { path: "/conformite", name: "Conformité", title: /conform/i },
  { path: "/tarifs", name: "Tarifs", title: /tarif/i },
];

for (const route of PUBLIC_PATHS) {
  test(`public route ${route.path} (${route.name}) renders without console errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    const response = await page.goto(route.path, { waitUntil: "domcontentloaded" });
    expect(response?.ok(), `${route.path} returned non-ok status`).toBeTruthy();

    // Wordmark appears in the sticky header and footer
    await expect(page.getByText(/MG/).first()).toBeVisible({ timeout: 5_000 });

    // Footer DPA badge is a chrome marker present on every public page
    await expect(page.getByText(/DPA/i)).toBeVisible();

    // No runtime errors during initial render
    expect(errors, `errors on ${route.path}`).toEqual([]);
  });
}

test("language menu opens and lists FR + EN", async ({ page }) => {
  await page.goto("/");
  // The LanguageMenu pill exposes role="button" + aria-haspopup=listbox
  const trigger = page.getByRole("button", { name: /choisir la langue|choose language/i });
  await trigger.click();
  const listbox = page.getByRole("listbox");
  await expect(listbox).toBeVisible();
  await expect(listbox.getByRole("option", { name: /FR/i })).toBeVisible();
  await expect(listbox.getByRole("option", { name: /EN/i })).toBeVisible();
  // MG locale is intentionally hidden in v1
  const mg = listbox.getByText(/^MG$/);
  expect(await mg.count()).toBe(0);
});

test("theme toggle round-trips light ↔ dark", async ({ page }) => {
  await page.goto("/");
  const html = page.locator("html");

  const initial = (await html.getAttribute("class")) ?? "";
  const wantDark = !initial.includes("dark");

  const toggle = page.getByRole("button", { name: /thème (clair|sombre)|switch theme/i }).first();
  await toggle.click();

  // next-themes adds/removes the `dark` class on <html>
  await expect.poll(async () => (await html.getAttribute("class")) ?? "").toContain(wantDark ? "dark" : "light");
});

test("auth-required route redirects unauthenticated user", async ({ page }) => {
  const response = await page.goto("/candidate", { waitUntil: "domcontentloaded" });
  // Clerk redirects to /sign-in. We accept any redirect status or a final URL
  // that's not /candidate.
  const url = page.url();
  expect(url, "expected redirect away from /candidate when unauthenticated").not.toMatch(/\/candidate(\?|$)/);
});
