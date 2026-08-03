import { expect, test } from "@playwright/test";

const SHARE_TARGET_ACTION = "/api/orders/image-intake/share";
const HEIC_MIME_TYPE = "image/heic";

test.describe("Share to PandaTrack", () => {
  test("manifest declares the image share target", async ({ request }) => {
    const response = await request.get("/manifest.webmanifest");
    expect(response.status()).toBe(200);

    const manifest = await response.json();
    const shareTarget = manifest.share_target;

    expect(shareTarget).toBeTruthy();
    expect(shareTarget.action).toBe(SHARE_TARGET_ACTION);
    expect(shareTarget.method).toBe("POST");
    expect(shareTarget.enctype).toBe("multipart/form-data");

    const files = shareTarget.params.files as Array<{ name: string; accept: string[] }>;
    expect(files).toHaveLength(1);
    expect(files[0].name).toBe("images");
    expect(files[0].accept).toEqual(["image/png", "image/jpeg", "image/webp"]);
    // HEIC cannot be decoded by the canvas compression step, so it must never be offered.
    expect(files[0].accept).not.toContain(HEIC_MIME_TYPE);
  });

  test("share target action stays inside the manifest scope", async ({ request }) => {
    const response = await request.get("/manifest.webmanifest");
    const manifest = await response.json();

    expect(manifest.share_target.action.startsWith(manifest.scope)).toBe(true);
  });

  test("service worker script carries the share-target handler", async ({ request }) => {
    const response = await request.get("/sw.js");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("javascript");

    const source = await response.text();
    // The OS POST is answered locally; asserting the wiring is the closest a browser test can get
    // without a real share sheet, which Playwright cannot drive.
    expect(source).toContain('self.addEventListener("fetch"');
    expect(source).toContain(`const SHARE_TARGET_ACTION_PATH = "${SHARE_TARGET_ACTION}";`);
    expect(source).toContain('const SHARE_STASH_CACHE_NAME = "panda-share-stash";');
  });

  test("service worker registers on the origin that serves the share target", async ({ page }) => {
    await page.goto("/en");

    const registrationState = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return "unsupported";
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      return registration ? "registered" : "failed";
    });

    expect(registrationState).toBe("registered");
  });

  test("share posted with no worker in front of it lands on the intake screen", async ({ request }) => {
    // Playwright's request context runs no service worker, which is exactly the degraded case: the
    // network fallback must turn the POST into the intake screen with a readable error instead of
    // a raw 404.
    const response = await request.post(SHARE_TARGET_ACTION, {
      multipart: {
        images: {
          name: "shared.png",
          mimeType: "image/png",
          buffer: Buffer.from("not-a-real-image"),
        },
      },
      maxRedirects: 0,
    });

    expect(response.status()).toBe(303);
    const location = response.headers()["location"];
    expect(location).toContain("/orders/new/image");
    expect(location).toContain("source=share");
    expect(location).toContain("stash=failed");
  });
});
