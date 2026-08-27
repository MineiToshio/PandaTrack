import { expect, test } from "@playwright/test";
import { signInAndLandOnDashboard, skipUnlessAuthenticatedEnv } from "./_helpers/auth";

/**
 * Geometry of the `Rangos` ladder, asserted in a real browser because nothing else can see it.
 *
 * Every defect this file covers shipped green: the components rendered the right elements with the
 * right attributes, and jsdom, which performs no layout at all, agreed. The damage was done by CSS
 * resolving those declarations against boxes the authors had assumed were something else, and it was
 * only ever visible on a rendered page (owner report, 2026-08-26):
 *
 *  - the summit's plate collapsed from 84 px to 4.6 px, taking the rank-10 artwork with it, because
 *    `width: min(<size>, 100%)` met a shrink-to-fit container and the percentage had nothing to
 *    resolve against;
 *  - the warm aura, sized in absolute pixels and so immune to that collapse, was left painting alone
 *    on the card, and was never centered on the emblem in the first place: auto margins may not go
 *    negative on the inline axis, so a 150 px circle asked to center in an 84 px box was pinned left
 *    with the whole surplus hanging off the right, which read as a red smudge beside the rank name;
 *  - the tab bar grew a full-height vertical scrollbar, because `overflow-x-auto` makes an element a
 *    scroll container in BOTH axes and the items' `-mb-px` hung one pixel past it.
 *
 * Read-only: it signs in, reads a few pages and asserts on layout. It writes nothing, so it is safe
 * against the dev database's real imported history.
 */

const LADDER_URL = "/en/progress/ranks";

/** Smallest emblem the design draws anywhere (`xs`, the mini-ladder rung). Below it, something collapsed. */
const SMALLEST_EMBLEM_PX = 38;

/** Half a CSS pixel of slack, for a centering assertion against fractional layout. */
const CENTERING_TOLERANCE_PX = 0.5;

test.describe("Rangos ladder", () => {
  test.beforeEach(async ({ page }) => {
    skipUnlessAuthenticatedEnv();
    await signInAndLandOnDashboard(page);
  });

  test("draws every rung's emblem at a real size, artwork loaded", async ({ page }) => {
    await page.goto(LADDER_URL);

    const summit = page.locator('figure[data-rank="10"]').first();
    await expect(summit).toBeVisible();

    const plates = await page.evaluate((floor) => {
      return [...document.querySelectorAll("figure[data-rank]")]
        .filter((plate) => plate.checkVisibility())
        .map((plate) => {
          const image = plate.querySelector("img");
          return {
            rank: (plate as HTMLElement).dataset.rank,
            width: plate.getBoundingClientRect().width,
            // A 404 leaves an `<img>` in the document that has finished loading and decoded nothing,
            // which is exactly how a rank whose file nobody published would look.
            artLoaded: Boolean(image?.complete) && (image?.naturalWidth ?? 0) > 0,
            collapsed: plate.getBoundingClientRect().width < floor,
          };
        });
    }, SMALLEST_EMBLEM_PX);

    // All ten rungs, plus the copies the mobile disclosure keeps (hidden at this viewport).
    expect(plates.length).toBeGreaterThanOrEqual(10);
    expect(plates.filter((plate) => plate.collapsed)).toEqual([]);
    expect(plates.filter((plate) => !plate.artLoaded)).toEqual([]);
  });

  test("centers the summit aura behind its emblem instead of beside it", async ({ page }) => {
    await page.goto(LADDER_URL);

    const centers = await page.evaluate(() => {
      const plate = document.querySelector('figure[data-rank="10"]')!;
      const aura = plate.previousElementSibling!;
      const centerOf = (element: Element) => {
        const box = element.getBoundingClientRect();
        return { x: box.x + box.width / 2, y: box.y + box.height / 2, width: box.width };
      };
      return { plate: centerOf(plate), aura: centerOf(aura) };
    });

    // The aura is wider than the plate on purpose: that is what makes it an aura, and also what made
    // the naive centering fail. Assert both facts, so a "fix" that merely shrank it would not pass.
    expect(centers.aura.width).toBeGreaterThan(centers.plate.width);
    expect(Math.abs(centers.aura.x - centers.plate.x)).toBeLessThanOrEqual(CENTERING_TOLERANCE_PX);
    expect(Math.abs(centers.aura.y - centers.plate.y)).toBeLessThanOrEqual(CENTERING_TOLERANCE_PX);
  });

  test("keeps the section's tab bar free of a scrollbar of its own", async ({ page }) => {
    await page.goto(LADDER_URL);

    const bar = page.getByRole("tablist");
    await expect(bar).toBeVisible();

    const overflow = await bar.evaluate((element) => ({
      vertical: element.scrollHeight - element.clientHeight,
      horizontal: element.scrollWidth - element.clientWidth,
    }));

    // Three tabs never need to scroll at a desktop width, on either axis. The vertical figure is the
    // regression: one pixel of it is all Chrome needs to paint a scrollbar down the side of the bar.
    expect(overflow.vertical).toBeLessThanOrEqual(0);
    expect(overflow.horizontal).toBeLessThanOrEqual(0);
  });
});
