import { expect, test } from "@playwright/test";

const MOBILE_VIEWPORT = { width: 375, height: 667 };
const MAIN_NAVIGATION_LABEL_REGEX = /main navigation|navegaci\u00f3n principal/i;
const OPEN_MENU_LABEL_REGEX = /open menu|abrir men\u00fa/i;
const EXPAND_SIDEBAR_LABEL_REGEX = /expand sidebar|expandir barra lateral/i;
const COLLAPSE_SIDEBAR_LABEL_REGEX = /collapse sidebar|contraer barra lateral/i;

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
    await page.goto("/en/sign-in");

    await page.getByLabel("Email").fill(process.env.E2E_USER_EMAIL!);
    await page.locator('input[name="password"]').fill(process.env.E2E_USER_PASSWORD!);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/en\/dashboard/);

    const openMenuButton = page.getByRole("button", { name: OPEN_MENU_LABEL_REGEX });
    await expect(openMenuButton).toBeVisible();
    await openMenuButton.click();

    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    await expect(page.getByRole("navigation", { name: MAIN_NAVIGATION_LABEL_REGEX })).toBeVisible();
    await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Stores" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Purchases" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Shipments" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();

    await page.getByRole("link", { name: "Stores" }).click();
    await expect(page).toHaveURL(/\/en\/stores/);
    await expect(page.getByRole("navigation", { name: MAIN_NAVIGATION_LABEL_REGEX })).not.toBeVisible();
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
    await page.goto("/en/sign-in");
    await page.getByLabel("Email").fill(process.env.E2E_USER_EMAIL!);
    await page.locator('input[name="password"]').fill(process.env.E2E_USER_PASSWORD!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/en\/dashboard/);

    const collapseButton = page.getByRole("button", { name: COLLAPSE_SIDEBAR_LABEL_REGEX });
    await expect(collapseButton).toBeVisible();
    await collapseButton.click();

    const expandButton = page.getByRole("button", { name: EXPAND_SIDEBAR_LABEL_REGEX }).first();
    await expect(expandButton).toBeVisible();

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

    await page.goto("/en/sign-in");
    await page.getByLabel("Email").fill(process.env.E2E_USER_EMAIL!);
    await page.locator('input[name="password"]').fill(process.env.E2E_USER_PASSWORD!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/en\/dashboard/);

    // Header (banner) shows page title; main content also has an h1, so target the banner heading to avoid strict mode.
    await expect(page.getByRole("banner").getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).not.toBeVisible();
  });

  test("nested route shows breadcrumbs and page title", async ({ page }) => {
    test.skip(
      !process.env.E2E_USER_EMAIL || !process.env.E2E_USER_PASSWORD,
      "E2E_USER_EMAIL and E2E_USER_PASSWORD must be set",
    );

    await page.goto("/en/sign-in");
    await page.getByLabel("Email").fill(process.env.E2E_USER_EMAIL!);
    await page.locator('input[name="password"]').fill(process.env.E2E_USER_PASSWORD!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/en\/dashboard/);

    await page.goto("/en/purchases/pre-orders");
    await expect(page).toHaveURL(/\/en\/purchases\/pre-orders/);

    const breadcrumbNav = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(breadcrumbNav).toBeVisible();
    await expect(breadcrumbNav.getByRole("link", { name: "Purchases" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pre-orders", level: 1 })).toBeVisible();
  });
});
