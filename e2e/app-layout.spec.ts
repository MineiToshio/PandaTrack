import { expect, test, type Page } from "@playwright/test";

const MOBILE_VIEWPORT = { width: 375, height: 667 };
const SIGN_IN_RETURN_TO_DASHBOARD = "/en/sign-in?returnTo=%2Fen%2Fdashboard";
const SIDEBAR_STORAGE_KEY = "appShellSidebarExpanded";
const SIDEBAR_COLLAPSED_STORAGE_VALUE = "false";
const MAIN_NAVIGATION_LABEL_REGEX = /main navigation|navegaci\u00f3n principal/i;
const OPEN_MENU_LABEL_REGEX = /open menu|abrir men\u00fa/i;
const EXPAND_SIDEBAR_LABEL_REGEX = /expand sidebar|expandir barra lateral/i;
const COLLAPSE_SIDEBAR_LABEL_REGEX = /collapse sidebar|contraer barra lateral/i;

async function signInAndLandOnDashboard(page: Page) {
  await page.context().clearCookies();
  await page.goto(SIGN_IN_RETURN_TO_DASHBOARD);
  await page.getByLabel("Email").fill(process.env.E2E_USER_EMAIL!);
  await page.locator('input[name="password"]').fill(process.env.E2E_USER_PASSWORD!);
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/en\/dashboard/, { timeout: 10_000 });
}

test.describe("App layout at mobile and tablet viewport", () => {
  test("unauthenticated user is redirected to sign-in from dashboard at mobile viewport", async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto("/en/dashboard");

    await expect(page).toHaveURL(/\/en\/sign-in\?returnTo=/);
    await expect(page.locator("form")).toBeVisible();
  });

  test("authenticated user at mobile viewport sees burger and drawer with primary nav", async ({ page }) => {
    test.skip(
      !process.env.E2E_USER_EMAIL || !process.env.E2E_USER_PASSWORD,
      "E2E_USER_EMAIL and E2E_USER_PASSWORD must be set for authenticated app layout tests",
    );

    await page.setViewportSize(MOBILE_VIEWPORT);
    await signInAndLandOnDashboard(page);

    const openMenuButton = page.getByRole("button", { name: OPEN_MENU_LABEL_REGEX });
    await expect(openMenuButton).toBeVisible();
    await openMenuButton.click();
    await expect(openMenuButton).toHaveAttribute("aria-expanded", "true");

    const primaryNavigation = page.getByRole("navigation", { name: MAIN_NAVIGATION_LABEL_REGEX });
    await expect(primaryNavigation).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Stores" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Purchases" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Shipments" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();

    await page.getByRole("link", { name: "Stores" }).click();
    await expect(page).toHaveURL(/\/en\/stores/);
    await expect(primaryNavigation).not.toBeVisible();
  });
});

test.describe("App layout desktop sidebar persistence", () => {
  const DESKTOP_VIEWPORT = { width: 1280, height: 720 };

  test("sidebar collapsed preference is restored after page reload", async ({ page }) => {
    test.skip(
      !process.env.E2E_USER_EMAIL || !process.env.E2E_USER_PASSWORD,
      "E2E_USER_EMAIL and E2E_USER_PASSWORD must be set",
    );

    await page.setViewportSize(DESKTOP_VIEWPORT);
    await signInAndLandOnDashboard(page);

    const collapseButton = page.getByRole("button", { name: COLLAPSE_SIDEBAR_LABEL_REGEX });
    await expect(collapseButton).toBeVisible();
    await collapseButton.click({ force: true });

    await expect
      .poll(async () => page.evaluate((storageKey) => window.localStorage.getItem(storageKey), SIDEBAR_STORAGE_KEY), {
        timeout: 10_000,
      })
      .toBe(SIDEBAR_COLLAPSED_STORAGE_VALUE);

    const expandButton = page.getByRole("button", { name: EXPAND_SIDEBAR_LABEL_REGEX }).first();
    await expect(expandButton).toBeVisible({ timeout: 10_000 });

    await page.reload();
    await expect(page).toHaveURL(/\/en\/dashboard/);

    await expect(page.getByRole("button", { name: EXPAND_SIDEBAR_LABEL_REGEX }).first()).toBeVisible();
  });
});

test.describe("App layout header and breadcrumbs", () => {
  test("first-level route shows page title only in header", async ({ page }) => {
    test.skip(
      !process.env.E2E_USER_EMAIL || !process.env.E2E_USER_PASSWORD,
      "E2E_USER_EMAIL and E2E_USER_PASSWORD must be set",
    );

    await signInAndLandOnDashboard(page);

    // Header (banner) shows page title; main content also has an h1, so target the banner heading to avoid strict mode.
    await expect(page.getByRole("banner").getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).not.toBeVisible();
  });

  test("nested route shows breadcrumbs and page title", async ({ page }) => {
    test.skip(
      !process.env.E2E_USER_EMAIL || !process.env.E2E_USER_PASSWORD,
      "E2E_USER_EMAIL and E2E_USER_PASSWORD must be set",
    );

    await signInAndLandOnDashboard(page);

    await page.goto("/en/purchases/pre-orders");
    await expect(page).toHaveURL(/\/en\/purchases\/pre-orders/);

    const breadcrumbNav = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(breadcrumbNav).toBeVisible();
    await expect(breadcrumbNav.getByRole("link", { name: "Purchases" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pre-orders", level: 1 })).toBeVisible();
  });
});
