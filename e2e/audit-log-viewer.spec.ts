import { expect, test, type Page } from "@playwright/test";
import { signInAsAdmin, skipUnlessAdminEnv } from "./_helpers/auth";

// Column headers come from the `admin` namespace, asserted per locale so the test proves the viewer
// is localized rather than hard-wired to one language.
const EN_HEADERS = [/^When$/, /^Admin$/, /^Action$/, /^Target$/, /^Reason$/];
const ES_HEADERS = [/^Cuándo$/, /^Admin$/, /^Acción$/, /^Objetivo$/, /^Motivo$/];
const EN_EMPTY_COPY = /no activity recorded yet/i;
const ES_EMPTY_COPY = /sin actividad registrada todavía/i;

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

  test("lists entries newest first when audit rows exist", async ({ page }) => {
    skipUnlessAdminEnv();
    await signInAsAdmin(page);
    await page.goto("/en/admin/audit");

    const rows = page.locator("tbody tr[data-created-at]");
    const rowCount = await rows.count();
    // Ordering can only be asserted with at least two rows; otherwise degrade gracefully.
    test.skip(rowCount < 2, "needs at least two seeded audit entries to assert ordering");

    const timestamps = await rows.evaluateAll((els) => els.map((el) => el.getAttribute("data-created-at") ?? ""));
    // ISO strings sort lexicographically; newest first means descending order.
    const descending = [...timestamps].sort((a, b) => b.localeCompare(a));
    expect(timestamps).toEqual(descending);
  });
});
