import { expect, test, type Page } from "@playwright/test";
import {
  signInAndLandOnDashboard,
  signInAsAdmin,
  skipUnlessAdminEnv,
  skipUnlessAuthenticatedEnv,
} from "./_helpers/auth";
import { deleteStoresBySlug } from "./_helpers/dbCleanup";
import { getUserRole } from "./_helpers/dbQuery";

// Column headers come from the `admin` namespace, asserted per locale so the test proves the viewer
// is localized rather than hard-wired to one language.
const EN_HEADERS = [/^When$/, /^Admin$/, /^Action$/, /^Target$/, /^Reason$/];
const ES_HEADERS = [/^Cuándo$/, /^Admin$/, /^Acción$/, /^Objetivo$/, /^Motivo$/];
const EN_EMPTY_COPY = /no activity recorded yet/i;
const ES_EMPTY_COPY = /sin actividad registrada todavía/i;

/**
 * Stores created by the current test, tracked so `afterEach` can hard-delete them, exactly as
 * `store-moderation.spec.ts` does. The `AdminAuditLog` rows the resolve/dismiss actions below write
 * are append-only (BR-01-02, `adminAuditMutations.ts`) and `targetId` carries no real foreign key to
 * `Store` (the schema has no relation there at all), so deleting the store never cascades to them:
 * they are accepted residue, matching the convention `store-moderation.spec.ts` already establishes
 * for every one of its own moderation actions (its "resolve"/"dismiss" tests leave the same rows
 * behind today, with no cleanup channel for them).
 */
let createdStoreSlugs: string[] = [];

test.afterEach(async () => {
  const slugs = createdStoreSlugs;
  createdStoreSlugs = [];
  await deleteStoresBySlug(slugs);
});

const CONTINUE = /^(continue|continuar)$/i;
const STORE_DETAIL_URL = /\/en\/stores\/(?!new)[a-z0-9-]+$/;

/** Walks the create-store wizard for a RETAILER seller and lands on the new store's detail page.
 *  Mirrors `store-moderation.spec.ts`'s helper of the same shape. */
async function createBusinessStoreAndOpenDetail(page: Page, name: string): Promise<string> {
  await page.goto("/en/stores/new");

  await page.getByRole("button", { name: CONTINUE }).first().click();

  const nameField = page.getByLabel(/store name|nombre de la tienda/i);
  await expect(nameField).toBeVisible({ timeout: 10_000 });
  await nameField.fill(name);
  await page.locator("#store-country").click();
  await page.getByRole("combobox").fill("Peru");
  await page
    .getByRole("option", { name: /peru|perú/i })
    .first()
    .click();
  await page.getByRole("button", { name: CONTINUE }).first().click();

  await page.getByRole("button", { name: /^manga$/i }).click();
  await page.getByRole("button", { name: /online store|tienda online/i }).click();
  await page.getByRole("button", { name: CONTINUE }).first().click();

  await page.getByRole("button", { name: CONTINUE }).first().click();

  await page.getByRole("button", { name: /create store|crear tienda/i }).click();

  await expect(page).toHaveURL(STORE_DETAIL_URL, { timeout: 15_000 });
  const url = page.url();
  createdStoreSlugs.push(url.split("/").pop()!);
  return url;
}

/**
 * Files one open report on the store detail page currently shown, then reloads so the governance
 * banner (which only renders when the store has reports) appears. Any signed-in user can report,
 * including the store's own owner (`store-moderation.spec.ts`'s "open report raises the derived
 * notice" and "dismisses" tests both self-report this same way). Mirrors that spec's helper.
 */
async function fileOpenReport(page: Page): Promise<void> {
  await page.getByRole("button", { name: /report store/i }).click();
  const reportDialog = page.getByRole("dialog", { name: /report/i });
  await expect(reportDialog).toBeVisible();
  // The radio's own `<input>` is visually hidden behind a decorative icon that sits on top of it,
  // so `getByRole("radio").click()` targets a point Playwright reports as covered and times out.
  // Clicking the visible label text instead is unobstructed and still toggles the input via the
  // browser's native label-for-control delegation.
  await reportDialog.getByText(/spam or scam/i).click();
  await reportDialog.getByRole("button", { name: /save report/i }).click();
  // Optimistic Confirmation: `StoreReportModal.tsx` closes the dialog synchronously on submit
  // (`setIsOpen(false)` before the server answers), so success surfaces afterward as a page-level
  // toast (`role="status"`), never as an inline status inside the (already-gone) dialog.
  await expect(page.getByRole("status").first()).toBeVisible({ timeout: 10_000 });
  await page.reload();
}

/**
 * Assert the viewer renders localized structure at `path`: when audit rows exist the semantic table
 * shows every column header; when the environment has no seeded rows the empty state shows instead.
 * Graceful degradation keeps the spec meaningful whether or not the admin env has audit data.
 */
async function assertLocalizedViewer(page: Page, path: string, headers: RegExp[], emptyCopy: RegExp) {
  await page.goto(path);
  await expect(page).toHaveURL(new RegExp(`${path}$`));

  const table = page.getByRole("table");
  if ((await table.count()) > 0) {
    for (const name of headers) {
      await expect(page.getByRole("columnheader", { name })).toBeVisible();
    }
  } else {
    await expect(page.getByText(emptyCopy)).toBeVisible();
  }
}

test.describe("Audit log viewer", () => {
  test("renders localized column headers or empty state in English", async ({ page }) => {
    skipUnlessAdminEnv();
    await signInAsAdmin(page);
    await assertLocalizedViewer(page, "/en/admin/audit", EN_HEADERS, EN_EMPTY_COPY);
  });

  test("renders localized column headers or empty state in Spanish", async ({ page }) => {
    skipUnlessAdminEnv();
    await signInAsAdmin(page);
    await assertLocalizedViewer(page, "/es/admin/audit", ES_HEADERS, ES_EMPTY_COPY);
  });

  test("lists entries newest first, proven by two fresh rows the spec writes itself", async ({ page }) => {
    skipUnlessAuthenticatedEnv();
    test.setTimeout(120_000);
    // Resolving/dismissing a report is an admin-only action (`storeModerationMutations.ts`), so this
    // needs the configured account to carry the role, exactly like every other admin-gated test in
    // the suite. Checked directly rather than via a second `E2E_ADMIN_*` identity: unlike
    // approve/apply-change-request (which need a genuine non-owner to produce a PENDING store or a
    // change request), reporting a store has no ownership restriction — `store-moderation.spec.ts`'s
    // own "resolve"/"dismiss" tests already have the SAME admin account file the report it then
    // resolves, so one identity is enough here.
    const role = await getUserRole(process.env.E2E_USER_EMAIL!);
    test.skip(
      role !== "admin",
      `E2E_USER_EMAIL (${process.env.E2E_USER_EMAIL}) must carry the admin role to exercise report resolve/dismiss through the moderation UI.`,
    );

    // The ordering assertion needs at least two rows to be meaningful, and the admin env's own
    // history is not something this spec controls. Rather than degrade gracefully when the
    // environment happens to be light on data (a `test.skip` that quietly never runs the assertion
    // it exists for), generate two fresh rows itself: one store, two of its own open reports, one
    // resolved and one dismissed, writing `report.resolve` then `report.dismiss` in immediate
    // succession (`storeModerationMutations.ts`).
    await signInAndLandOnDashboard(page);
    await createBusinessStoreAndOpenDetail(page, `E2E Audit Order ${Date.now()}`);

    await fileOpenReport(page);
    await page.getByRole("button", { name: /view summary/i }).click();
    const resolveDialog = page.getByRole("dialog", { name: /reports and suggestions/i });
    await expect(resolveDialog).toBeVisible();
    const resolveButton = resolveDialog.getByRole("button", { name: /^resolve$/i }).first();
    await expect(resolveButton).toBeVisible();
    await resolveButton.click();
    await expect(resolveDialog.getByRole("button", { name: /^resolve$/i })).toHaveCount(0, { timeout: 10_000 });
    await page.keyboard.press("Escape");
    await page.reload();

    await fileOpenReport(page);
    await page.getByRole("button", { name: /view summary/i }).click();
    const dismissDialog = page.getByRole("dialog", { name: /reports and suggestions/i });
    await expect(dismissDialog).toBeVisible();
    const dismissButton = dismissDialog.getByRole("button", { name: /^dismiss$/i }).first();
    await expect(dismissButton).toBeVisible();
    await dismissButton.click();
    await expect(dismissDialog.getByRole("button", { name: /^dismiss$/i })).toHaveCount(0, { timeout: 10_000 });
    await page.keyboard.press("Escape");

    await page.goto("/en/admin/audit");
    const rows = page.locator("tbody tr[data-created-at]");
    // At least the two rows this test just wrote; a hard assertion rather than a skip, since the
    // setup above is what guarantees it.
    expect(await rows.count()).toBeGreaterThanOrEqual(2);

    const timestamps = await rows.evaluateAll((els) => els.map((el) => el.getAttribute("data-created-at") ?? ""));
    // ISO strings sort lexicographically; newest first means descending order.
    const descending = [...timestamps].sort((a, b) => b.localeCompare(a));
    expect(timestamps).toEqual(descending);
  });
});
