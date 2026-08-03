import { expect, test } from "@playwright/test";
import { signInAndLandOnDashboard, skipUnlessAuthenticatedEnv } from "./_helpers/auth";
import { deletePushSubscriptionsByEndpointPrefix } from "./_helpers/dbCleanup";

/**
 * Push opt-in from the Settings Notifications section.
 *
 * Playwright's bundled Chromium does not implement the Push API at all: `window.PushManager`
 * and `ServiceWorkerRegistration.prototype.pushManager` are missing (service workers themselves
 * work). The init script therefore DEFINES those globals with deterministic fakes rather than
 * patching prototypes that may not exist; the server action still runs for real and persists the
 * (stubbed) subscription. Notification permission is granted at the Playwright context level so
 * `Notification.requestPermission` resolves `granted` without a prompt.
 *
 * That real persisted `PushSubscription` row needs its own cleanup: the fake endpoint always
 * starts with `PUSH_ENDPOINT_PREFIX`, so `afterEach` sweeps it directly from the database as a
 * backstop, since there is no "unsubscribe" UI affordance this spec drives.
 */
const PUSH_ENDPOINT_PREFIX = "https://push.example.com/e2e-";

test.afterEach(async () => {
  await deletePushSubscriptionsByEndpointPrefix(PUSH_ENDPOINT_PREFIX);
});

test.describe("Notifications opt-in", () => {
  test("enables the master toggle and reveals the per-type reminder toggles", async ({ page, context }) => {
    skipUnlessAuthenticatedEnv();

    await context.grantPermissions(["notifications"]);

    await page.addInitScript((endpointPrefix) => {
      const fakeSubscription = {
        endpoint: `${endpointPrefix}${Math.random().toString(36).slice(2)}`,
        toJSON() {
          return { endpoint: this.endpoint, keys: { p256dh: "e2e-p256dh", auth: "e2e-auth" } };
        },
        unsubscribe() {
          return Promise.resolve(true);
        },
      };
      class FakePushManager {
        subscribe() {
          return Promise.resolve(fakeSubscription);
        }
        getSubscription() {
          return Promise.resolve(null);
        }
      }
      const globalScope = window as unknown as Record<string, unknown>;
      if (!("PushManager" in window)) {
        globalScope.PushManager = FakePushManager;
      }
      if ("ServiceWorkerRegistration" in window) {
        const fakePushManager = new FakePushManager();
        Object.defineProperty(ServiceWorkerRegistration.prototype, "pushManager", {
          configurable: true,
          get: () => fakePushManager,
        });
      }
      if (window.Notification) {
        // Headless Chromium reports Notification.permission as "denied" regardless of
        // context.grantPermissions, so the permission surface is faked alongside the
        // Push API to keep the flow deterministic.
        window.Notification.requestPermission = () => Promise.resolve("granted" as NotificationPermission);
        Object.defineProperty(window.Notification, "permission", {
          configurable: true,
          get: () => "granted" as NotificationPermission,
        });
      }
    }, PUSH_ENDPOINT_PREFIX);

    await signInAndLandOnDashboard(page);

    await page.goto("/en/settings");
    const tablist = page.getByRole("tablist", { name: /settings sections|secciones de ajustes/i }).first();
    await tablist.getByRole("tab", { name: /preferences|preferencias/i }).click();

    await expect(page.getByRole("heading", { name: /notifications|notificaciones/i })).toBeVisible();

    const masterToggle = page.getByRole("switch", { name: /enable reminders|activar recordatorios/i });
    await expect(masterToggle).toBeVisible();
    await expect(masterToggle).not.toBeChecked();

    const paymentToggle = page.getByRole("switch", { name: /upcoming payment|pago próximo/i });
    await expect(paymentToggle).toBeDisabled();

    // The switch input is visually hidden (sr-only) behind its decorative track, which
    // intercepts pointer events; clicking the wrapping label toggles the input natively.
    await page.locator("label").filter({ has: masterToggle }).click();

    // The subscribe round-trip is async (permission + push manager), so poll for the enabled state.
    await expect(masterToggle).toBeChecked({ timeout: 10_000 });
    await expect(paymentToggle).toBeEnabled();
    await expect(page.getByRole("switch", { name: /upcoming arrival|llegada próxima/i })).toBeEnabled();
    await expect(page.getByRole("switch", { name: /overdue arrival|llegada atrasada/i })).toBeEnabled();
    await expect(page.getByRole("switch", { name: /store rejected|tienda rechazada/i })).toBeEnabled();

    // The test-send action only appears once the channel is active.
    await expect(page.getByRole("button", { name: /send test|enviar prueba/i })).toBeVisible();
  });
});
