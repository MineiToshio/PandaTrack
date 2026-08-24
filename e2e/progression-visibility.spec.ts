import { expect, test, type Page } from "@playwright/test";
import { signInAndLandOnDashboard, skipUnlessAuthenticatedEnv } from "./_helpers/auth";
import { deleteDefaultProgressionSettings } from "./_helpers/dbCleanup";

/**
 * The collector's switch over the whole progression layer (`FR-12-38`, `AC-12-13`).
 *
 * What makes this worth an E2E and not a component test: the three surfaces the switch controls are
 * owned by three different renderers (the shell's navigation, the dashboard's server-rendered
 * widget, and the `/{locale}/progress` section's server-side gate), and the promise is that they
 * move together, in the same tick, from one client toggle. Only the real shell proves that.
 *
 * This runs against the collector's real database, and the switch writes a row of real account
 * state, so the toggle is restored from `afterEach` (not inline) and the row it created is dropped
 * from `afterAll` when it is still at its defaults.
 */

const MAIN_NAVIGATION_LABEL_REGEX = /main navigation|navegación principal/i;
const PROGRESS_NAV_NAME_REGEX = /^(progress|progreso)$/i;
/** The dashboard glance is located by its own overlay link, which is the whole card's click target. */
const PROGRESS_WIDGET_LINK_REGEX = /see my progress|ver mi progreso/i;
const HIDE_SWITCH_NAME_REGEX = /hide my progression|ocultar mi progresión/i;
const PROGRESS_TABS_LABEL_REGEX = /progress sections|secciones de progreso/i;
const SETTINGS_TABLIST_NAME_REGEX = /settings sections|secciones de ajustes/i;
const PREFERENCES_TAB_NAME_REGEX = /preferences|preferencias/i;

const NOT_FOUND_STATUS = 404;

/**
 * True while the layer is hidden. Real account state, not disposable test data, so `afterEach`
 * restores it even when the test fails between switching it on and switching it back off: a mid-test
 * failure must never leave the collector's own progression layer hidden.
 */
let progressionHiddenByThisRun = false;

function progressNavLink(page: Page) {
  return page
    .getByRole("navigation", { name: MAIN_NAVIGATION_LABEL_REGEX })
    .getByRole("link", { name: PROGRESS_NAV_NAME_REGEX });
}

function progressWidgetLink(page: Page) {
  return page.getByRole("link", { name: PROGRESS_WIDGET_LINK_REGEX });
}

function hideProgressionSwitch(page: Page) {
  return page.getByRole("switch", { name: HIDE_SWITCH_NAME_REGEX });
}

async function openPreferencesPane(page: Page): Promise<void> {
  await page.goto("/en/settings");
  const tablist = page.getByRole("tablist", { name: SETTINGS_TABLIST_NAME_REGEX }).first();
  await tablist.getByRole("tab", { name: PREFERENCES_TAB_NAME_REGEX }).click();
  await expect(hideProgressionSwitch(page)).toBeVisible();
}

/**
 * Flips the switch to the requested state and waits for it to settle there.
 *
 * The switch input is `sr-only` behind its decorative track, which intercepts pointer events, so the
 * wrapping label is what gets clicked (same approach as `notifications-opt-in.spec.ts`). Already
 * being in the requested state is a no-op, which is what makes this safe to call from `afterEach`.
 */
async function setProgressionHidden(page: Page, hide: boolean): Promise<void> {
  const toggle = hideProgressionSwitch(page);
  await expect(toggle).toBeVisible();
  if ((await toggle.isChecked()) === hide) return;

  await page.locator("label").filter({ has: toggle }).click();
  progressionHiddenByThisRun = hide;

  if (hide) {
    await expect(toggle).toBeChecked();
  } else {
    await expect(toggle).not.toBeChecked();
  }
}

test.afterEach(async ({ page }) => {
  if (!progressionHiddenByThisRun) return;
  await openPreferencesPane(page).catch(() => {});
  await setProgressionHidden(page, false).catch(() => {});
  progressionHiddenByThisRun = false;
});

test.afterAll(async () => {
  // The switch is the only writer of `progression_settings`, and the row it creates outlives the
  // toggle being flipped back. Dropped here only while it still carries both defaults, so the table
  // ends the run exactly as the run found it. See `scripts/e2e-db-cleanup.ts` for the guard.
  const email = process.env.E2E_USER_EMAIL;
  if (!email) return;
  await deleteDefaultProgressionSettings(email);
});

test.describe("Progression visibility switch", () => {
  test.describe.configure({ mode: "serial" });

  test("hides the nav entry, the dashboard glance and the section, then restores all three", async ({ page }) => {
    skipUnlessAuthenticatedEnv();
    await signInAndLandOnDashboard(page);

    // Baseline: the layer is on, so both surfaces the switch owns are on screen.
    await expect(progressNavLink(page)).toBeVisible();
    await expect(progressWidgetLink(page)).toBeVisible();

    await openPreferencesPane(page);
    await expect(hideProgressionSwitch(page)).not.toBeChecked();
    await setProgressionHidden(page, true);

    // No reload between the click and this assertion: the shell holds the flag in client state
    // seeded from the server, so the entry has to go in the same tick the switch moves (`FR-12-38`).
    await expect(progressNavLink(page)).toHaveCount(0);

    // Typing the URL must not get around the switch either: the gate is server-side, in the
    // section's layout, so the route answers 404 rather than rendering behind a hidden entry.
    const hiddenResponse = await page.goto("/en/progress");
    expect(hiddenResponse?.status()).toBe(NOT_FOUND_STATUS);
    await expect(page.getByRole("tablist", { name: PROGRESS_TABS_LABEL_REGEX })).toHaveCount(0);

    await openPreferencesPane(page);
    await expect(hideProgressionSwitch(page)).toBeChecked();
    await setProgressionHidden(page, false);
    await expect(progressNavLink(page)).toBeVisible();

    // The widget is server-rendered from the same flag, so the dashboard is re-read rather than
    // asserted against the settings document.
    await page.goto("/en/dashboard");
    await expect(progressWidgetLink(page)).toBeVisible();
    await expect(progressNavLink(page)).toBeVisible();

    const restoredResponse = await page.goto("/en/progress");
    expect(restoredResponse?.status()).not.toBe(NOT_FOUND_STATUS);
    await expect(page.getByRole("tablist", { name: PROGRESS_TABS_LABEL_REGEX })).toBeVisible();
  });
});
