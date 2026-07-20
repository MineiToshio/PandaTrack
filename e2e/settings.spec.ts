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

  test("currency change uses an inline select with an explicit save/cancel confirm", async ({ page }) => {
    skipUnlessAuthenticatedEnv();
    await signInAndLandOnDashboard(page);

    await page.goto("/en/settings");
    const tablist = page.getByRole("tablist", { name: /settings sections|secciones de ajustes/i }).first();
    await tablist.getByRole("tab", { name: /preferences|preferencias/i }).click();

    const currencySelect = page.getByRole("button", { name: /base currency|moneda base/i });
    await expect(currencySelect).toBeVisible();
    // The trigger label reads "USD — US dollar"; the leading 3 chars are the current base code.
    const originalCode = ((await currencySelect.textContent()) ?? "").trim().slice(0, 3).toUpperCase();
    const targetCode = originalCode === "USD" ? "EUR" : "USD";

    const save = page.getByRole("button", { name: /^save$|^guardar$/i });
    // No confirm controls until the selection actually changes (base currency is not autosaved).
    await expect(save).toHaveCount(0);

    await currencySelect.click();
    await page.getByRole("option", { name: new RegExp(`^${targetCode}`) }).click();

    // Changing the selection reveals an explicit save + cancel confirm — no modal, no auto-apply.
    const cancel = page.getByRole("button", { name: /^cancel$|^cancelar$/i });
    await expect(save).toBeVisible();
    await expect(cancel).toBeVisible();

    await save.click();
    // "Cancel" clears only once the server action resolves (its label is stable, unlike
    // "Save" → "Saving…"), so it is the reliable commit signal.
    await expect(cancel).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByRole("button", { name: /base currency|moneda base/i })).toContainText(targetCode);

    // Restore the original base currency so the run leaves the account as it found it.
    await page.getByRole("button", { name: /base currency|moneda base/i }).click();
    await page.getByRole("option", { name: new RegExp(`^${originalCode}`) }).click();
    await save.click();
    await expect(cancel).toHaveCount(0, { timeout: 15_000 });
  });
});
