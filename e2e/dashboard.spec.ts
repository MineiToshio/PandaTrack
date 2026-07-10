import { expect, test } from "@playwright/test";
import { signInAndLandOnDashboard, skipUnlessAuthenticatedEnv } from "./_helpers/auth";

// The precise obligation math (overdue fold-in, no-date exclusion, FX-partial exclusion) is asserted
// directly against the aggregation layer in `src/lib/data/dashboard/_tests/*`. This E2E proves the
// end-to-end path unit tests cannot: the dashboard Server Component resolves the session, runs
// `getDashboardData`, and renders the cash & obligations and upcoming-payments zones.
// Zone locators are pinned to `:visible`. The dashboard has a `loading.tsx`, so React streams its
// content into a hidden element and swaps it in; sampling during that window would otherwise see two
// copies of every zone and trip Playwright's strict mode.
test.describe("dashboard cash & obligations zone", () => {
  test.beforeEach(skipUnlessAuthenticatedEnv);

  test("renders the cash and upcoming-payments zones for an authenticated collector", async ({ page }) => {
    await signInAndLandOnDashboard(page);

    // Page-level greeting header. The app shell header shows the page title as plain text (not
    // a heading), so the page's own h1 is the only heading in the document; scoped to main anyway
    // for clarity about which h1 is under test.
    await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toBeVisible();

    // Cash & obligations zone renders from the aggregation payload.
    const cashZone = page.locator('section[aria-labelledby="dashboard-cash-title"]:visible');
    await expect(cashZone).toBeVisible();
    await expect(page.locator("#dashboard-cash-title:visible")).toBeVisible();

    // The protagonist "due this month" figure and the paid-vs-pending split are present.
    await expect(cashZone.getByText(/due this month/i)).toBeVisible();
    await expect(cashZone.getByText(/paid vs pending/i)).toBeVisible();

    // Budget zone renders (either the consumption meter or the configure-budget affordance).
    const budgetZone = page.locator('section[aria-labelledby="dashboard-budget-title"]:visible');
    await expect(budgetZone).toBeVisible();
    await expect(page.locator("#dashboard-budget-title:visible")).toBeVisible();

    // Scoped trends section renders with its shared range control.
    await expect(page.locator("#dashboard-trends-title:visible")).toBeVisible();

    // Upcoming-payments zone renders (either the list or its empty state).
    await expect(page.locator("#dashboard-upcoming-payments-title:visible")).toBeVisible();
  });

  test("range control drives the trend charts but leaves the current-period metrics fixed", async ({ page }) => {
    await signInAndLandOnDashboard(page);

    const trendsSection = page.locator('section[aria-labelledby="dashboard-trends-title"]:visible');
    await expect(trendsSection).toBeVisible();

    // The scoped section owns the single shared range control, defaulting to the last 6 months.
    const rangeTrigger = trendsSection.locator('button[aria-haspopup="dialog"]');
    await expect(rangeTrigger).toContainText(/last 6 months/i);

    // Capture the fixed current-period figure before changing the range (FR-06-12 / AC-06-06).
    const disbursedFigure = trendsSection
      .getByText(/disbursed this month/i)
      .locator("..")
      .locator("p")
      .last();
    const disbursedBefore = (await disbursedFigure.textContent())!.trim();

    await rangeTrigger.click();
    await page.getByRole("button", { name: /last 12 months/i }).click();

    await expect(page).toHaveURL(/range=12m/);
    await expect(rangeTrigger).toContainText(/last 12 months/i);

    // The trend charts re-bucket to the new window...
    await expect(trendsSection.getByRole("img", { name: /12 months/i }).first()).toBeVisible();
    // ...while the fixed current-month figure is untouched.
    await expect(disbursedFigure).toHaveText(disbursedBefore);
  });

  test("activity zone exposes its three lists through an accessible tablist", async ({ page }) => {
    await signInAndLandOnDashboard(page);

    const activityZone = page.locator('section[aria-labelledby="dashboard-activity-title"]:visible');
    await expect(activityZone).toBeVisible();

    const tablist = activityZone.getByRole("tablist");
    await expect(tablist).toBeVisible();

    const recentTab = activityZone.getByRole("tab", { name: /latest/i });
    const overdueTab = activityZone.getByRole("tab", { name: /overdue/i });

    // The recent list opens first; exactly one panel is visible at a time.
    await expect(recentTab).toHaveAttribute("aria-selected", "true");
    await expect(activityZone.getByRole("tabpanel")).toHaveCount(1);

    await overdueTab.click();
    await expect(overdueTab).toHaveAttribute("aria-selected", "true");
    await expect(recentTab).toHaveAttribute("aria-selected", "false");
  });

  test("placed-vs-arrived chart and punctuality donut render", async ({ page }) => {
    await signInAndLandOnDashboard(page);

    const trendsSection = page.locator('section[aria-labelledby="dashboard-trends-title"]:visible');
    await expect(trendsSection.getByRole("img", { name: /orders placed vs arrived/i })).toBeVisible();

    // Punctuality lives in the right-hand stack, and shows either the donut or its empty note.
    const punctualityZone = page.locator('section[aria-labelledby="dashboard-punctuality-title"]:visible');
    await expect(punctualityZone).toBeVisible();
  });

  test("collection zone renders its breakdowns and links stores through the preference-driven helper", async ({
    page,
  }) => {
    await signInAndLandOnDashboard(page);

    const collectionZone = page.locator('section[aria-labelledby="dashboard-collection-title"]:visible');
    await expect(collectionZone).toBeVisible();

    // The status bar sums the collector's non-cancelled orders (BR-06-07).
    await expect(collectionZone.getByRole("img", { name: /orders by status/i })).toBeVisible();

    // The zone's store CTA points at the public listing, carrying the collector's preferences (FR-06-16).
    const seeStores = collectionZone.getByRole("link", { name: /view stores/i });
    await expect(seeStores).toBeVisible();
    await expect(seeStores).toHaveAttribute("href", /\/stores(\?|$)/);

    // Top-store rows link into each store's detail page.
    const topStoreLinks = collectionZone.locator('a[href*="/stores/"]');
    if ((await topStoreLinks.count()) > 0) {
      await expect(topStoreLinks.first()).toHaveAttribute("href", /\/stores\/[^/?]+$/);
    }
  });

  test("KPI strip surfaces the collection totals", async ({ page }) => {
    await signInAndLandOnDashboard(page);
    for (const label of [/^orders$/i, /^products$/i, /^committed$/i, /^stores$/i]) {
      await expect(page.getByText(label).first()).toBeVisible();
    }
  });

  test("budget zone shows either a consumption meter or the configure-budget affordance", async ({ page }) => {
    await signInAndLandOnDashboard(page);

    const budgetZone = page.locator('section[aria-labelledby="dashboard-budget-title"]:visible');
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
