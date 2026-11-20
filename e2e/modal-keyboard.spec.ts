import { expect, test, type Locator, type Page } from "@playwright/test";
import { createServer, type ViteDevServer } from "vite";
import path from "node:path";

let server: ViteDevServer;
let fixtureUrl: string;
const VIEWPORT_HEIGHT = 812;

test.use({
  viewport: { width: 375, height: VIEWPORT_HEIGHT },
  isMobile: true,
  hasTouch: true,
});

test.beforeAll(async () => {
  server = await createServer({
    configFile: false,
    root: process.cwd(),
    resolve: { alias: { "@": path.resolve(process.cwd(), "src") } },
    esbuild: { jsx: "automatic" },
    server: { host: "127.0.0.1", port: 0 },
  });
  await server.listen();
  const address = server.httpServer!.address();
  if (!address || typeof address === "string") throw new Error("Fixture server has no TCP address");
  fixtureUrl = `http://127.0.0.1:${address.port}/e2e/_fixtures/modalKeyboard.html`;
});

test.afterAll(async () => {
  await server?.close();
});

async function changeViewport(page: Page, height: number, offsetTop = 0, event = "resize"): Promise<void> {
  await page.evaluate(
    ({ height, offsetTop, event }) => {
      Object.assign(window.visualViewport!, { height, offsetTop });
      window.visualViewport!.dispatchEvent(new Event(event));
    },
    { height, offsetTop, event },
  );
}

async function bounds(locator: Locator) {
  return locator.evaluate((element) => {
    const { top, bottom, height } = element.getBoundingClientRect();
    return { top, bottom, height };
  });
}

for (const theme of ["dark", "light"]) {
  for (const expanded of [false, true]) {
    test(`restores sheet geometry after repeated keyboard changes (${theme}, expanded=${expanded})`, async ({
      page,
    }) => {
      await page.addInitScript(() => {
        const viewport = new EventTarget();
        Object.assign(viewport, { height: window.innerHeight, offsetTop: 0, scale: 1 });
        Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
      });
      await page.goto(`${fixtureUrl}${expanded ? "?expanded" : ""}`);
      await page.locator("html").evaluate((element, theme) => {
        element.dataset.theme = theme;
      }, theme);
      await page.getByRole("button", { name: "Open fixture" }).click();
      const sheet = page.getByRole("dialog");
      await expect(sheet).toHaveAttribute("data-vaul-drawer", "");
      await expect(sheet).toHaveCSS("bottom", "0px");
      await expect.poll(async () => (await bounds(sheet)).bottom).toBe(VIEWPORT_HEIGHT);
      const original = await bounds(sheet);
      const input = page.getByRole("textbox", { name: "Note fixture" });
      await input.focus();

      // A second substantial height change reproduces Vaul's boolean-toggle desynchronization.
      for (const height of [500, 420, 500]) {
        await changeViewport(page, height);
        await expect(sheet).toHaveCSS("bottom", `${VIEWPORT_HEIGHT - height}px`);
        await expect.poll(async () => (await bounds(sheet)).bottom).toBe(height);
        await expect.poll(async () => (await bounds(input)).bottom <= height).toBe(true);
        const body = sheet.locator("[data-modal-sheet-body]");
        await expect.poll(async () => (await bounds(input)).bottom <= (await bounds(body)).bottom).toBe(true);
        expect((await bounds(sheet.locator("footer"))).bottom).toBeLessThanOrEqual(height);
        expect((await bounds(sheet)).top).toBeGreaterThanOrEqual(0);
      }

      await changeViewport(page, 500, 50, "scroll");
      await expect(sheet).toHaveCSS("bottom", "262px");
      // Android's dismiss-keyboard action can leave the input focused.
      await changeViewport(page, VIEWPORT_HEIGHT);
      await expect(sheet).toHaveCSS("bottom", "0px");
      await expect.poll(() => bounds(sheet)).toEqual(original);
      await expect(input).toBeFocused();

      await changeViewport(page, 500);
      await expect(sheet).toHaveCSS("bottom", "312px");
      await sheet.getByRole("button", { name: "Close" }).focus();
      await expect(sheet).toHaveCSS("bottom", "0px");
      await changeViewport(page, VIEWPORT_HEIGHT);
      await expect.poll(() => bounds(sheet)).toEqual(original);
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      await sheet.getByRole("button", { name: "Close" }).click();
      await expect(sheet).toHaveCount(0);
      await page.getByRole("button", { name: "Open fixture" }).click();
      await expect.poll(() => bounds(sheet)).toEqual(original);
    });
  }
}

test("fits phone, tablet, and desktop viewports", async ({ page }) => {
  await page.goto(fixtureUrl);
  await page.getByRole("button", { name: "Open fixture" }).click();
  for (const width of [320, 375, 767, 768, 1024, 1280]) {
    await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    await expect
      .poll(async () => {
        const rect = await sheet.boundingBox();
        return (
          rect !== null &&
          rect.x >= 0 &&
          rect.x + rect.width <= width &&
          rect.y >= 0 &&
          rect.y + rect.height <= VIEWPORT_HEIGHT
        );
      })
      .toBe(true);
  }
});
