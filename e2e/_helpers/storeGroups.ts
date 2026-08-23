import type { Page } from "@playwright/test";
/**
 * Opens every store group. They land closed (`FR-05-70`), so any flow that works inside a group has
 * to open it first; the whole header row is the disclosure control now, not a chevron.
 */
export async function expandStoreGroups(page: Page): Promise<void> {
  const triggers = page.locator('[aria-controls^="store-group-body-"][aria-expanded="false"]');
  for (let index = (await triggers.count()) - 1; index >= 0; index -= 1) {
    await triggers.nth(index).click();
  }
}
