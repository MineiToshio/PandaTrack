import { expect, test } from "@playwright/test";
import { signInAndLandOnDashboard, skipUnlessAuthenticatedEnv } from "./_helpers/auth";

test.describe("Settings", () => {
  test.describe.configure({ mode: "serial" });

  test("renders the three section tabs with the profile pane active", async ({ page }) => {
    skipUnlessAuthenticatedEnv();
    await signInAndLandOnDashboard(page);

    await page.goto("/en/settings");
    await expect(page).toHaveURL(/\/en\/settings/);

    const tablist = page.getByRole("tablist", { name: /settings sections|secciones de ajustes/i }).first();
    await expect(tablist.getByRole("tab", { name: /profile|perfil/i })).toBeVisible();
    await expect(tablist.getByRole("tab", { name: /account|cuenta/i })).toBeVisible();
    await expect(tablist.getByRole("tab", { name: /preferences|preferencias/i })).toBeVisible();
    await expect(tablist.getByRole("tab", { name: /profile|perfil/i })).toHaveAttribute("aria-selected", "true");

    await expect(page.getByText(/username|nombre de usuario/i).first()).toBeVisible();
  });

  test("switches panes between account and preferences", async ({ page }) => {
    skipUnlessAuthenticatedEnv();
    await signInAndLandOnDashboard(page);

    await page.goto("/en/settings");
    const tablist = page.getByRole("tablist", { name: /settings sections|secciones de ajustes/i }).first();

    await tablist.getByRole("tab", { name: /account|cuenta/i }).click();
    await expect(page.getByText(/password|contraseña/i).first()).toBeVisible();

    await tablist.getByRole("tab", { name: /preferences|preferencias/i }).click();
    await expect(page.getByRole("radio", { name: /light|claro/i })).toBeVisible();
    await expect(page.getByRole("radio", { name: /dark|oscuro/i })).toBeVisible();
    await expect(page.getByRole("radio", { name: /español/i })).toBeVisible();
    await expect(page.getByRole("radio", { name: /english/i })).toBeVisible();
  });

  test("currency change modal offers the two-path footer and saves without updating rates", async ({ page }) => {
    skipUnlessAuthenticatedEnv();
    await signInAndLandOnDashboard(page);

    await page.goto("/en/settings");
    const tablist = page.getByRole("tablist", { name: /settings sections|secciones de ajustes/i }).first();
    await tablist.getByRole("tab", { name: /preferences|preferencias/i }).click();

    await page
      .getByRole("button", { name: /^change$|^cambiar$/i })
      .first()
      .click();

    const dialog = page.getByRole("dialog", { name: /change base currency|cambiar moneda base/i });
    await expect(dialog).toBeVisible();

    const saveWithout = dialog.getByRole("button", { name: /save without updating|guardar sin actualizar/i });
    const saveAndUpdate = dialog.getByRole("button", { name: /save and update|guardar y actualizar/i });
    await expect(saveWithout).toBeVisible();
    await expect(saveAndUpdate).toBeVisible();

    // Pick whichever of USD/EUR is not currently selected so the form is dirty,
    // keeping the e2e account in a known currency either way.
    const usdOption = dialog.getByRole("option", { name: /USD/ });
    const usdSelected = (await usdOption.getAttribute("aria-selected")) === "true";
    const targetCode = usdSelected ? "EUR" : "USD";
    await dialog.getByRole("option", { name: new RegExp(targetCode) }).click();

    await saveWithout.click();

    await expect(dialog).toBeHidden();
    await expect(page.getByText(targetCode, { exact: true }).first()).toBeVisible();
  });
});
