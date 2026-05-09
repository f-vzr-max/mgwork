import { test, expect } from "@playwright/test";

// SKIPPED — requires seeded candidates + Clerk enterprise user.
test.skip("enterprise creates an offer and shortlists matches", async ({ page }) => {
  // TODO when M5/M6 land:
  //   1. Sign in as enterprise user (FREE plan, 0 active offers).
  //   2. Visit /enterprise/offers/new.
  //   3. Fill title, description, sector, slots, requirements, langRequired.
  //   4. Save as ACTIVE; expect freemium gate respects 3-offer cap.
  //   5. Open the offer detail; matchings panel renders top-N candidates.
  //   6. Click Shortlist on the top candidate; an Application row is created.
  await page.goto("/");
  await expect(page).toHaveURL(/.*/);
});
