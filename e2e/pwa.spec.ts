import { expect, test } from "@playwright/test";
import { signInAndLandOnDashboard, skipUnlessAuthenticatedEnv } from "./_helpers/auth";

test.describe("PWA installability", () => {
  test("manifest is served with the required installability fields", async ({ request }) => {
    const response = await request.get("/manifest.webmanifest");
    expect(response.status()).toBe(200);

    const manifest = await response.json();

    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.display).toBe("standalone");
    expect(typeof manifest.theme_color).toBe("string");
    expect(typeof manifest.background_color).toBe("string");

    const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes);
    expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]));

    const maskableIcon = manifest.icons.find((icon: { purpose?: string }) => icon.purpose === "maskable");
    expect(maskableIcon).toBeTruthy();
    expect(maskableIcon.sizes).toBe("512x512");
  });

  test("every manifest icon asset resolves", async ({ request }) => {
    const manifestResponse = await request.get("/manifest.webmanifest");
    const manifest = await manifestResponse.json();

    for (const icon of manifest.icons as Array<{ src: string }>) {
      const iconResponse = await request.get(icon.src);
      expect(iconResponse.status(), `expected ${icon.src} to resolve`).toBe(200);
    }
  });

  test("service worker script is served with a JavaScript content type", async ({ request }) => {
    const response = await request.get("/sw.js");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("javascript");
  });

  test("manifest is linked from the document head on an authenticated page", async ({ page }) => {
    skipUnlessAuthenticatedEnv();

    await signInAndLandOnDashboard(page);

    const manifestLink = page.locator('link[rel="manifest"]');
    await expect(manifestLink).toHaveAttribute("href", "/manifest.webmanifest");
  });

  test("service worker registers successfully on an authenticated load", async ({ page }) => {
    skipUnlessAuthenticatedEnv();

    await signInAndLandOnDashboard(page);

    // Registration is fired from a client-side effect in the authenticated app shell
    // (`ServiceWorkerRegistration`, mounted by `AppLayout`), so poll rather than assert instantly.
    await expect
      .poll(async () => {
        return page.evaluate(async () => {
          if (!("serviceWorker" in navigator)) return "unsupported";
          const registration = await navigator.serviceWorker.getRegistration("/");
          return registration ? "registered" : "pending";
        });
      })
      .toBe("registered");
  });
});
