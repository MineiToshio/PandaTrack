import { expect, test, type Page } from "@playwright/test";
import { signInAndLandOnDashboard, skipUnlessAuthenticatedEnv } from "./_helpers/auth";

const MOBILE_VIEWPORT = { width: 375, height: 667 };
const MAIN_NAVIGATION_LABEL_REGEX = /main navigation|navegaci\u00f3n principal/i;
const OPEN_MENU_LABEL_REGEX = /open menu|abrir men\u00fa/i;
const ACCOUNT_ACTIONS_LABEL_REGEX = /account actions|acciones de cuenta/i;
const EXPAND_SIDEBAR_LABEL_REGEX = /expand sidebar|expandir barra lateral/i;
const COLLAPSE_SIDEBAR_LABEL_REGEX = /collapse sidebar|contraer barra lateral/i;
const RETRY_ATTEMPTS = 3;
const RETRY_WAIT_MS = 250;

async function openMobileDrawer(page: Page) {
  const openMenuButton = page.getByRole("button", { name: OPEN_MENU_LABEL_REGEX });
  const primaryNavigation = page.getByRole("navigation", { name: MAIN_NAVIGATION_LABEL_REGEX });

  await expect(openMenuButton).toBeVisible();

  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt += 1) {
    await openMenuButton.click({ force: true });

    if (await primaryNavigation.isVisible()) {
      return;
    }

    await page.waitForTimeout(RETRY_WAIT_MS);
  }

  await expect(primaryNavigation).toBeVisible({ timeout: 10_000 });
}

async function collapseDesktopSidebar(page: Page) {
  const collapseButton = page.getByRole("button", { name: COLLAPSE_SIDEBAR_LABEL_REGEX });
  const expandButton = page.getByRole("button", { name: EXPAND_SIDEBAR_LABEL_REGEX }).first();

  await expect(collapseButton).toBeVisible();

  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt += 1) {
    await collapseButton.click({ force: true });

    if (await expandButton.isVisible()) {
      return;
    }

    await page.waitForTimeout(RETRY_WAIT_MS);
  }

  await expect(expandButton).toBeVisible({ timeout: 10_000 });
}

test.describe("App layout at mobile and tablet viewport", () => {
  test.describe.configure({ mode: "serial" });

  test("unauthenticated user is redirected to sign-in from dashboard at mobile viewport", async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto("/en/dashboard");

    await expect(page).toHaveURL(/\/en\/sign-in\?returnTo=/);
    await expect(page.locator("form")).toBeVisible();
  });

  test("authenticated user at mobile viewport sees burger and drawer with primary nav", async ({ page }) => {
    skipUnlessAuthenticatedEnv();

    await page.setViewportSize(MOBILE_VIEWPORT);
    await signInAndLandOnDashboard(page);
    await openMobileDrawer(page);
    const primaryNavigation = page.getByRole("navigation", { name: MAIN_NAVIGATION_LABEL_REGEX });
    // Scoped to the drawer nav: dashboard content behind it also has a "View stores" link,
    // whose accessible name matches an unscoped, non-exact "Stores" query.
    await expect(primaryNavigation.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(primaryNavigation.getByRole("link", { name: "Stores", exact: true })).toBeVisible();
    await expect(primaryNavigation.getByRole("link", { name: "Orders" })).toBeVisible();
    await expect(primaryNavigation.getByRole("link", { name: "Deliveries" })).toBeVisible();
    await expect(primaryNavigation.getByRole("link", { name: "Settings" })).toHaveCount(0);
    await page.getByRole("button", { name: ACCOUNT_ACTIONS_LABEL_REGEX }).click();
    await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Privacy Policy" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Terms and Conditions" })).toBeVisible();

    await primaryNavigation.getByRole("link", { name: "Stores", exact: true }).click();
    await expect(page).toHaveURL(/\/en\/stores/);
    await expect(primaryNavigation).not.toBeVisible();
  });
});

test.describe("App layout desktop sidebar persistence", () => {
  test.describe.configure({ mode: "serial" });

  const DESKTOP_VIEWPORT = { width: 1280, height: 720 };

  test("sidebar collapsed preference is restored after page reload", async ({ page }) => {
    skipUnlessAuthenticatedEnv();

    await page.setViewportSize(DESKTOP_VIEWPORT);
    await signInAndLandOnDashboard(page);
    await collapseDesktopSidebar(page);

    await page.reload();
    await expect(page).toHaveURL(/\/en\/dashboard/);

    await expect(page.getByRole("button", { name: EXPAND_SIDEBAR_LABEL_REGEX }).first()).toBeVisible();
  });

  test("desktop sidebar exposes settings and legal links through the lower account menu", async ({ page }) => {
    skipUnlessAuthenticatedEnv();

    await page.setViewportSize(DESKTOP_VIEWPORT);
    await signInAndLandOnDashboard(page);

    // Unlike the mobile drawer, the desktop sidebar's primary nav includes a direct Settings
    // link (see `getAllNavItems()` in src/components/modules/Sidebar.tsx) in addition to the
    // account menu below, which also surfaces Settings alongside the legal links.
    await expect(
      page.getByRole("navigation", { name: MAIN_NAVIGATION_LABEL_REGEX }).getByRole("link", { name: "Settings" }),
    ).toBeVisible();
    await page.getByRole("button", { name: ACCOUNT_ACTIONS_LABEL_REGEX }).click();
    await expect(page.getByRole("link", { name: "Settings" }).last()).toBeVisible();
    await expect(page.getByRole("link", { name: "Privacy Policy" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Terms and Conditions" })).toBeVisible();
  });
});

test.describe("App layout header and breadcrumbs", () => {
  test.describe.configure({ mode: "serial" });

  test("first-level route shows page title only in header", async ({ page }) => {
    skipUnlessAuthenticatedEnv();

    await signInAndLandOnDashboard(page);

    // Header (banner) shows page title; main content also has an h1, so target the banner heading to avoid strict mode.
    await expect(page.getByRole("banner").getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).not.toBeVisible();
  });

  test("nested route shows breadcrumbs and page title", async ({ page }) => {
    skipUnlessAuthenticatedEnv();

    await signInAndLandOnDashboard(page);

    await page.goto("/en/purchases/pre-orders");
    await expect(page).toHaveURL(/\/en\/orders\/pre-orders/);

    const breadcrumbNav = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(breadcrumbNav).toBeVisible();
    await expect(breadcrumbNav.getByRole("link", { name: "Orders" })).toBeVisible();

    // The orders list also renders its own "Pre-orders" h1 in main content for this filtered
    // view, so scope to the banner (like the first-level test above) to avoid strict mode.
    await expect(page.getByRole("banner").getByRole("heading", { name: "Pre-orders", level: 1 })).toBeVisible();
  });
});
