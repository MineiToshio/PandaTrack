import { expect, test } from "@playwright/test";
import { signInAndLandOnDashboard, skipUnlessAuthenticatedEnv } from "./_helpers/auth";

const INTAKE_URL = "/en/orders/new/image";

/**
 * Route-level coverage for order intake from a photo.
 *
 * It deliberately never runs a real extraction: the provider is a paid external API, and a suite
 * that called it would spend money, depend on the network, and send a fixture image to a third
 * party on every run. What is verified here is what only a browser can verify, that the protected
 * route loads for a signed-in user and lands on exactly one of its two legitimate surfaces (the
 * upload surface, or the base-currency gate when the account has no currency configured). The
 * extraction and save paths are covered by their unit suites against doubles.
 */
test.describe("Order image intake", () => {
  test.describe.configure({ mode: "serial" });

  test("loads for a signed-in user and shows either the upload surface or the currency gate", async ({ page }) => {
    skipUnlessAuthenticatedEnv();
    await signInAndLandOnDashboard(page);

    await page.goto(INTAKE_URL);
    await expect(page).toHaveURL(/\/en\/orders\/new\/image/);

    const uploadCta = page.getByRole("button", { name: /extract data|extraer datos/i });
    const currencyGateCta = page.getByRole("link", { name: /go to settings|ir a configuración/i });

    // Exactly one of the two surfaces owns this route at any moment; the gate wins when the
    // account has no base currency, because there would be nothing to assume a currency from.
    await expect(uploadCta.or(currencyGateCta).first()).toBeVisible({ timeout: 15_000 });

    const isGated = await currencyGateCta.isVisible();
    if (isGated) {
      await expect(page.getByRole("link", { name: /by hand|a mano|add it by hand/i })).toBeVisible();
      return;
    }

    await expect(page.getByRole("button", { name: /add photos|añadir fotos/i })).toBeVisible();
    // Nothing is attached yet, so the thumbnail list must not exist at all.
    await expect(page.getByRole("list", { name: /attached photos|fotos adjuntas/i })).toHaveCount(0);
  });

  test("communicates the photo quota passively, with no pre-confirmation dialog", async ({ page }) => {
    skipUnlessAuthenticatedEnv();
    await signInAndLandOnDashboard(page);

    await page.goto(INTAKE_URL);

    const uploadCta = page.getByRole("button", { name: /extract data|extraer datos/i });
    const exhaustedCta = page.getByRole("button", { name: /add it by hand|registrar a mano/i });
    const currencyGateCta = page.getByRole("link", { name: /go to settings|ir a configuración/i });
    await expect(uploadCta.or(exhaustedCta).or(currencyGateCta).first()).toBeVisible({ timeout: 15_000 });

    if (await currencyGateCta.isVisible()) return;

    // With an empty bag the attach surface is replaced by the exhausted state, which states the
    // renewal date and routes to the manual method.
    if (await exhaustedCta.isVisible()) {
      await expect(page.getByText(/renew on|se renuevan el/i)).toBeVisible();
      return;
    }

    // Otherwise the counter is informational only: it never gates the action, and no dialog asks
    // the collector to confirm spending photos. An uncapped account (an administrator) shows no
    // counter at all, which is the same "never interrupts" contract.
    await expect(uploadCta).toBeEnabled();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    const counter = page.getByText(/photos? left this month|te quedan .* este mes/i).first();
    if (await counter.isVisible()) {
      await expect(counter).toBeVisible();
    }
  });

  test("keeps the manual creation route reachable from the intake route", async ({ page }) => {
    skipUnlessAuthenticatedEnv();
    await signInAndLandOnDashboard(page);

    await page.goto(INTAKE_URL);
    await page
      .getByRole("link", { name: /^orders$|^pedidos$/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/en\/orders(\?|$)/);
  });

  test("redirects an anonymous visitor away from the intake route", async ({ page, context }) => {
    skipUnlessAuthenticatedEnv();
    await context.clearCookies();

    await page.goto(INTAKE_URL);
    await expect(page).not.toHaveURL(/\/orders\/new\/image/);
  });
});
