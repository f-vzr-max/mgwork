import { test, expect } from "@playwright/test";

// SKIPPED — see onboarding-candidate.spec.ts for context.
test.skip("enterprise completes onboarding flow end-to-end", async ({ page }) => {
  // TODO when M2/M3 land:
  //   1. Sign in as Clerk test user with role=enterprise.
  //   2. Visit /onboarding/enterprise.
  //   3. Fill companyName, sector, contactName, contactPhone.
  //   4. Submit; expect redirect to /enterprise/dashboard.
  //   5. Verify a FREE-plan Enterprise row was created.
  await page.goto("/");
  await expect(page).toHaveURL(/.*/);
});
