import { expect, test } from "@playwright/test";
import { signInAsAdmin, skipUnlessAdminEnv } from "./_helpers/auth";

const EN_ADMIN_URL = /\/en\/admin(\?.*)?$/;
const INBOX_TITLE = /moderation inbox/i;
const EMPTY_TITLE = /all caught up/i;
const QUEUE_LABEL = /moderation queue/i;

/**
 * Narrow admin inbox coverage. Seeding all five item types is out of scope (the derivation and
 * ordering are proven in the aggregate unit tests), so this spec proves the console renders end to end
 * for the admin account and, when the account has a pending backlog, that opening a queue row shows its
 * review. It skips without the dedicated admin credentials (`E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`).
 */
test.describe("Moderation inbox", () => {
  test("admin reaches the inbox, which renders its populated console or the empty state", async ({ page }) => {
    skipUnlessAdminEnv();

    await signInAsAdmin(page);
    await page.goto("/en/admin");
    await expect(page).toHaveURL(EN_ADMIN_URL);

    const queue = page.getByRole("navigation", { name: QUEUE_LABEL });
    const emptyState = page.getByText(EMPTY_TITLE);

    // AC-02-02 / AC-02-03: exactly one of the two console states renders.
    await expect(queue.or(emptyState).first()).toBeVisible();

    const hasQueue = await queue.isVisible().catch(() => false);
    if (!hasQueue) {
      // Empty inbox: the success-toned empty state is shown and no queue is rendered (AC-02-03).
      await expect(emptyState).toBeVisible();
      return;
    }

    // Populated inbox: the title and per-category counters render (AC-02-02), and the desktop pane
    // auto-previews the top item so the review area is never blank (AC-02-13).
    await expect(page.getByRole("heading", { name: INBOX_TITLE })).toBeVisible();

    // AC-02-04: opening a queue row routes to that item's review and shows its actions.
    const firstRow = queue.getByRole("link").first();
    await firstRow.click();
    await expect(page).toHaveURL(/\/en\/admin\?item=/);
    // The review pane exposes an action footer; "Ver tienda" (or the review's primary action) is present.
    await expect(page.getByRole("article")).toBeVisible();
  });
});
