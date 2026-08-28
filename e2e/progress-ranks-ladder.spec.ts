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
 * The second describe covers the `Progreso` section's ARTWORK contract, which has the same shape of
 * risk and rides the same sign-in: the pieces are drawn frameless, and a locked one is drained by a
 * per-theme `filter` token. Both are questions only a real cascade can answer — jsdom sees the class
 * but never the value it resolves to, and a token declared in one theme block and forgotten in the
 * other fails nowhere else.
 *
 * Read-only: it signs in, reads a few pages and asserts on layout. It writes nothing, so it is safe
 * against the dev database's real imported history.
 */

const LADDER_URL = "/en/progress/ranks";
const ALBUM_URL = "/en/progress/medals";

/** Smallest emblem the design draws anywhere (`xs`, the mini-ladder rung). Below it, something collapsed. */
const SMALLEST_EMBLEM_PX = 38;

/** Half a CSS pixel of slack, for a centering assertion against fractional layout. */
const CENTERING_TOLERANCE_PX = 0.5;

/** A piece is drawn edge to edge in its box; a pixel of slack for fractional layout. */
const FULL_BLEED_TOLERANCE_PX = 1;

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

/** Every visible piece on the page: its box, the box its artwork actually fills, and how it is drawn. */
async function readPieces(page: import("@playwright/test").Page, selector: string) {
  return page.evaluate((sel) => {
    return [...document.querySelectorAll(sel)]
      .filter((piece) => piece.checkVisibility())
      .map((piece) => {
        const image = piece.querySelector("img");
        const box = piece.getBoundingClientRect();
        const artBox = image?.getBoundingClientRect();
        return {
          key: (piece as HTMLElement).dataset.rank ?? (piece as HTMLElement).dataset.medal ?? "",
          locked: (piece as HTMLElement).dataset.band === "locked" || (piece as HTMLElement).dataset.locked === "true",
          width: box.width,
          artWidth: artBox?.width ?? 0,
          artHeight: artBox?.height ?? 0,
          hasArt: Boolean(image),
          filter: image ? getComputedStyle(image).filter : "",
          // The three shapes the old frame took, in order: the ring (a border on the piece), the
          // plate behind it (a background), and the second ring the art was nested inside (a wrapper
          // between the piece and its image). The padlock chip is deliberately NOT counted: it is a
          // badge in the corner, not a frame around the motif.
          framed: (() => {
            const style = getComputedStyle(piece);
            return (
              style.borderTopWidth !== "0px" ||
              style.backgroundImage !== "none" ||
              style.backgroundColor !== "rgba(0, 0, 0, 0)" ||
              (Boolean(image) && image?.parentElement !== piece)
            );
          })(),
        };
      });
  }, selector);
}

test.describe("Progreso artwork", () => {
  test.beforeEach(async ({ page }) => {
    skipUnlessAuthenticatedEnv();
    await signInAndLandOnDashboard(page);
  });

  test("draws rank and medal artwork edge to edge, with no frame of the UI's own", async ({ page }) => {
    for (const [url, selector] of [
      [LADDER_URL, "figure[data-rank]"],
      [ALBUM_URL, "figure[data-medal]"],
    ]) {
      await page.goto(url);
      // Only the pieces that actually draw artwork: a catalogue row with no `imageKey` renders the
      // placeholder glyph, which has no box of its own to compare against.
      const pieces = (await readPieces(page, selector)).filter((piece) => piece.hasArt);
      expect(pieces.length).toBeGreaterThan(0);

      // The pieces already carry their own rim, so the ring the UI used to draw was a frame around a
      // frame — and it cost the art a fifth of its own box, because the plate reserved an inset for
      // it. Both halves are asserted: the artwork fills the box, and nothing paints a border or a
      // plate behind it. A unit test sees the classes; only a browser sees the boxes they produce.
      for (const piece of pieces) {
        expect(
          Math.abs(piece.artWidth - piece.width),
          `${selector} ${piece.key} art is inset from its box`,
        ).toBeLessThanOrEqual(FULL_BLEED_TOLERANCE_PX);
        expect(piece.artHeight).toBeCloseTo(piece.artWidth, 0);
        expect(piece.framed, `${selector} ${piece.key} draws a frame`).toBe(false);
      }
    }
  });

  test("drains a locked piece through a filter that answers to the theme", async ({ page }) => {
    await page.goto(ALBUM_URL);

    const readByTheme = async (theme: string) => {
      await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
      const pieces = (await readPieces(page, "figure[data-medal]")).filter((piece) => piece.hasArt);
      return {
        locked: pieces.filter((piece) => piece.locked),
        unlocked: pieces.filter((piece) => !piece.locked),
      };
    };

    const light = await readByTheme("light");
    const dark = await readByTheme("dark");

    // The album has to SAY which pieces are locked before anything can check how they are drawn.
    expect(light.locked.length, "no medal published `data-locked`").toBeGreaterThan(0);
    expect(light.unlocked.length, "every medal reads as locked").toBeGreaterThan(0);

    // An earned piece is never touched: a filter here would be the app dimming its own reward.
    for (const piece of [...light.unlocked, ...dark.unlocked]) {
      expect(piece.filter, `${piece.key} is earned but filtered`).toBe("none");
    }
    // A locked one always is, and the recipe is NOT the same in both themes. `--locked-art-filter`
    // declared in one theme block and forgotten in the other resolves to `none` there and the album
    // silently stops distinguishing locked from earned, with nothing failing anywhere else.
    for (const piece of [...light.locked, ...dark.locked]) {
      expect(piece.filter, `${piece.key} is locked but undrained`).not.toBe("none");
    }
    expect(dark.locked[0].filter).not.toBe(light.locked[0].filter);
  });
});
