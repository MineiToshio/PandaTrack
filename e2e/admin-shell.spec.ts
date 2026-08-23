import { expect, test } from "@playwright/test";
import {
  signInAndLandOnDashboard,
  signInAsAdmin,
  skipUnlessAdminEnv,
  skipUnlessAuthenticatedEnv,
  skipUnlessConfiguredUserIsNonAdmin,
} from "./_helpers/auth";

const MODERATION_NAV_LABEL = /moderación|moderation/i;
const ADMIN_SECTION_LABEL = /administración|administration/i;
const DASHBOARD_URL = /\/en\/dashboard/;
const EN_ADMIN_URL = /\/en\/admin$/;
const ES_ADMIN_URL = /\/es\/admin$/;

// Console copy from the `admin` namespace, asserted per locale so the test proves the console is
// localized rather than hard-wired to one language. Each alternation covers both console states: the
// populated inbox title (`inbox.title`) or the success-toned empty state (`inbox.empty.title`), since
// the E2E account's pending backlog is not seeded by this spec.
const EN_LANDING_COPY = /moderation inbox|all caught up/i;
const ES_LANDING_COPY = /bandeja de moderación|todo al día/i;

test.describe("Admin space shell and gating", () => {
  test("non-admin sees no admin nav entry and is refused at the admin space", async ({ page }) => {
    skipUnlessAuthenticatedEnv();
    await skipUnlessConfiguredUserIsNonAdmin();

    await signInAndLandOnDashboard(page);

    // AC-02-15: the Administración navigation entry never renders for a non-administrator.
    await expect(page.getByRole("link", { name: MODERATION_NAV_LABEL })).toHaveCount(0);

    // AC-02-01 / AC-02-16: a direct hit is refused by requireAdmin() regardless of nav visibility;
    // the effective refusal is a redirect to the collector dashboard, so no moderation data renders.
    await page.goto("/en/admin");
    await expect(page).toHaveURL(DASHBOARD_URL);
    await expect(page.getByText(EN_LANDING_COPY)).toHaveCount(0);
  });

  test("admin sees the Administración section and reaches the localized space", async ({ page }) => {
    skipUnlessAdminEnv();

    await signInAsAdmin(page);

    // AC-02-15: the administrator sees the grouped Administración section and its moderation entry.
    await expect(page.getByText(ADMIN_SECTION_LABEL).first()).toBeVisible();
    const moderationLink = page.getByRole("link", { name: MODERATION_NAV_LABEL }).first();
    await expect(moderationLink).toBeVisible();

    // The entry leads to /[locale]/admin and the English console renders from the admin namespace.
    await moderationLink.click();
    await expect(page).toHaveURL(EN_ADMIN_URL);
    await expect(page.getByText(EN_LANDING_COPY)).toBeVisible();

    // AC-02-06: the same space renders localized copy under /es/admin.
    await page.goto("/es/admin");
    await expect(page).toHaveURL(ES_ADMIN_URL);
    await expect(page.getByText(ES_LANDING_COPY)).toBeVisible();
  });
});
