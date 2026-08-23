import { expect, type Locator, type Page } from "@playwright/test";

/** Every store group's disclosure control in the Orders "Por tienda" view. */
function groupTriggers(page: Page): Locator {
  return page.locator('[aria-controls^="store-group-body-"]');
}

/**
 * Opens every store group. They land closed (`FR-05-70`), so any flow that works inside a group has
 * to open one first; the whole header row is the disclosure control now, not a chevron.
 *
 * The retry is the point of this helper, not a precaution. The list is server-rendered, so each
 * trigger is in the HTML well before React has hydrated it, and a click that lands in that window
 * is swallowed silently: no error, no state change, and the test fails much later on a product that
 * "isn't there". Polling until `aria-expanded` actually flips is what makes the intent
 * ("this group is open") the thing being waited for, rather than the gesture.
 *
 * The state is re-read inside the retry so a click is only ever sent to a group that is still
 * closed. Clicking blind on every attempt would toggle a group that opened on the previous pass
 * straight back shut.
 */
export async function expandStoreGroups(page: Page): Promise<void> {
  const triggers = groupTriggers(page);
  await triggers.first().waitFor({ state: "visible", timeout: 15_000 });

  for (let index = 0, total = await triggers.count(); index < total; index += 1) {
    const trigger = triggers.nth(index);
    await expect(async () => {
      if ((await trigger.getAttribute("aria-expanded")) !== "true") {
        await trigger.click();
      }
      await expect(trigger).toHaveAttribute("aria-expanded", "true", { timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
  }
}
