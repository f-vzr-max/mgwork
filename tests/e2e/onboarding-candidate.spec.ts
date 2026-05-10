import { test, expect } from "@playwright/test";

// SKIPPED until Wave 2 ships the candidate onboarding routes and a Clerk
// test-user fixture is wired into CI. This file exists so `playwright test
// --list` validates the structure compiles.
test.skip("candidate completes onboarding flow end-to-end", async ({ page }) => {
  // TODO when M2/M3 land:
  //   1. Sign in as Clerk test user with role=candidate.
  //   2. Visit /onboarding.
  //   3. Fill firstName, lastName, dateOfBirth, phone, city.
  //   4. Pick at least one sector and three skills.
  //   5. Submit; expect redirect to /dashboard with profileScore > 0.
  //   6. Verify the new candidate row exists via the /api/candidate endpoint.
  await page.goto("/");
  await expect(page).toHaveURL(/.*/);
});
