import { test, expect } from "@playwright/test";

// SKIPPED — requires storage bucket fixtures + staff auth.
test.skip("candidate uploads passport, staff approves it", async ({ page }) => {
  // TODO when M3/M4 land:
  //   1. Candidate signs in, navigates to /documents.
  //   2. Uploads a sample PDF (fixtures/passport.pdf) tagged PASSPORT.
  //   3. Backend stores it as PENDING.
  //   4. Staff (separate session) opens /staff/documents/[id].
  //   5. Clicks Approve; document transitions to APPROVED.
  //   6. Candidate refreshes; profileScore reflects the new approved doc.
  await page.goto("/");
  await expect(page).toHaveURL(/.*/);
});
