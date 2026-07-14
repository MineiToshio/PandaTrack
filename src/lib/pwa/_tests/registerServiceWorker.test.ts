import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const captureExceptionMock = vi.fn();

vi.mock("@sentry/nextjs", () => ({ captureException: captureExceptionMock }));

async function importRegisterServiceWorker() {
  const registerServiceWorkerModule = await import("../registerServiceWorker");
  return registerServiceWorkerModule.registerServiceWorker;
}

describe("registerServiceWorker", () => {
  beforeEach(() => {
    vi.resetModules();
    captureExceptionMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("registers the service worker with the expected script and scope when supported", async () => {
    const registerMock = vi.fn().mockResolvedValue({});
    vi.stubGlobal("navigator", { serviceWorker: { register: registerMock } });

    const registerServiceWorker = await importRegisterServiceWorker();
    await registerServiceWorker();

    expect(registerMock).toHaveBeenCalledWith("/sw.js", { scope: "/" });
    expect(registerMock).toHaveBeenCalledTimes(1);
  });

  it("registers only once across repeat calls (idempotent)", async () => {
    const registerMock = vi.fn().mockResolvedValue({});
    vi.stubGlobal("navigator", { serviceWorker: { register: registerMock } });

    const registerServiceWorker = await importRegisterServiceWorker();
    await registerServiceWorker();
    await registerServiceWorker();
    await registerServiceWorker();

    expect(registerMock).toHaveBeenCalledTimes(1);
  });

  it("does nothing when the browser has no serviceWorker support (expected, no capture)", async () => {
    vi.stubGlobal("navigator", {});

    const registerServiceWorker = await importRegisterServiceWorker();
    await expect(registerServiceWorker()).resolves.toBeUndefined();

    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it("tolerates a registration failure: does not throw and captures once with Sentry", async () => {
    const registrationError = new Error("registration blocked");
    const registerMock = vi.fn().mockRejectedValue(registrationError);
    vi.stubGlobal("navigator", { serviceWorker: { register: registerMock } });

    const registerServiceWorker = await importRegisterServiceWorker();
    await expect(registerServiceWorker()).resolves.toBeUndefined();

    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
    expect(captureExceptionMock).toHaveBeenCalledWith(registrationError, {
      extra: { action: "registerServiceWorker" },
    });
  });
});
