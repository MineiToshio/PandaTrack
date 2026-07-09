import { expect, test } from "@playwright/test";
import { shouldSkipAuthenticatedE2E, signInAndLandOnDashboard } from "./_helpers/auth";

function skipUnlessAuthenticatedEnv() {
  test.skip(shouldSkipAuthenticatedE2E(), "E2E_USER_EMAIL and E2E_USER_PASSWORD must be set");
  test.skip(
    process.env.PLAYWRIGHT_PORT !== undefined && process.env.PLAYWRIGHT_PORT !== "3000",
    "Authenticated E2E uses Better Auth's local trusted origin on localhost:3000",
  );
}

// The precise obligation math (overdue fold-in, no-date exclusion, FX-partial exclusion) is asserted
// directly against the aggregation layer in `src/lib/data/dashboard/_tests/*`. This E2E proves the
// end-to-end path unit tests cannot: the dashboard Server Component resolves the session, runs
// `getDashboardData`, and renders the cash & obligations and upcoming-payments zones.
test.describe("dashboard cash & obligations zone", () => {
  test.beforeEach(skipUnlessAuthenticatedEnv);

  test("renders the cash and upcoming-payments zones for an authenticated collector", async ({ page }) => {
    await signInAndLandOnDashboard(page);

    // Page-level greeting header.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // Cash & obligations zone renders from the aggregation payload.
    const cashZone = page.locator('section[aria-labelledby="dashboard-cash-title"]');
    await expect(cashZone).toBeVisible();
    await expect(page.locator("#dashboard-cash-title")).toBeVisible();

    // The protagonist "due this month" figure and the paid-vs-pending split are present.
    await expect(cashZone.getByText(/due this month/i)).toBeVisible();
    await expect(cashZone.getByText(/paid vs pending/i)).toBeVisible();

    // Budget zone renders (either the consumption meter or the configure-budget affordance).
    const budgetZone = page.locator('section[aria-labelledby="dashboard-budget-title"]');
    await expect(budgetZone).toBeVisible();
    await expect(page.locator("#dashboard-budget-title")).toBeVisible();

    // Upcoming-payments zone renders (either the list or its empty state).
    await expect(page.locator("#dashboard-upcoming-payments-title")).toBeVisible();
  });

  test("budget zone shows either a consumption meter or the configure-budget affordance", async ({ page }) => {
    await signInAndLandOnDashboard(page);

    const budgetZone = page.locator('section[aria-labelledby="dashboard-budget-title"]');
    await expect(budgetZone).toBeVisible();

    const meter = budgetZone.getByRole("img", { name: /of budget used/i });
    const configureCta = budgetZone.getByRole("link", { name: /set up budget/i });

    // Exactly one of the two states is present: a budget is configured, or it is not (FR-06-06).
    const meterCount = await meter.count();
    if (meterCount > 0) {
      await expect(meter).toBeVisible();
      await expect(configureCta).toHaveCount(0);
    } else {
      await expect(configureCta).toBeVisible();
      await expect(configureCta).toHaveAttribute("href", /\/settings$/);
    }
  });
});
