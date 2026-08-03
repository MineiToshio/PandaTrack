import { ZodError } from "zod";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSessionMock,
  getCollectorPreferencesSnapshotMock,
  parseAndApplyCollectorPreferencesPatchMock,
  updateUserLocaleMock,
  cookiesMock,
  cookieStoreSetMock,
  captureExceptionMock,
} = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  getCollectorPreferencesSnapshotMock: vi.fn(),
  parseAndApplyCollectorPreferencesPatchMock: vi.fn(),
  updateUserLocaleMock: vi.fn(),
  cookiesMock: vi.fn(),
  cookieStoreSetMock: vi.fn(),
  captureExceptionMock: vi.fn(),
}));

vi.mock("@/lib/auth/auth-server", () => ({ getSession: getSessionMock }));

vi.mock("@/lib/data/auth/userMutations", () => ({ updateUserLocale: updateUserLocaleMock }));

vi.mock("@/lib/data/user-settings/userSettingsQueries", () => ({
  getCollectorPreferencesSnapshot: getCollectorPreferencesSnapshotMock,
}));

vi.mock("@/lib/data/user-settings/userSettingsMutations", () => ({
  parseAndApplyCollectorPreferencesPatch: parseAndApplyCollectorPreferencesPatchMock,
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

vi.mock("@sentry/nextjs", () => ({ captureException: captureExceptionMock }));

import { savePreferencesAction, updateLanguageAction } from "../preferencesActions";

const AUTHENTICATED_SESSION = { user: { id: "user-1" } };

const BASE_PAYLOAD = {
  preferredCountryCode: "US",
  baseCurrencyCode: "USD",
  preferredProductTypeKeys: ["figures"],
  budgetAmount: 10000,
  budgetResetDayOfMonth: 1,
};

describe("savePreferencesAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);

    const result = await savePreferencesAction(BASE_PAYLOAD);

    expect(result).toEqual({ ok: false, error: "unauthorized" });
    expect(parseAndApplyCollectorPreferencesPatchMock).not.toHaveBeenCalled();
  });

  it("persists the patch through the single preferences path", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    parseAndApplyCollectorPreferencesPatchMock.mockResolvedValue({ ok: true });

    const result = await savePreferencesAction(BASE_PAYLOAD);

    expect(result).toEqual({ ok: true });
    expect(parseAndApplyCollectorPreferencesPatchMock).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ baseCurrencyCode: "USD" }),
    );
  });

  it("takes the same path when the base currency changes, with no companion flagging write", async () => {
    // Pending-ness is derived per row from the rate's own recorded base, so a currency change (or a
    // change back) needs no bulk write. The old flagging pass is what re-marked already-reconciled
    // orders on a PEN -> X -> PEN round trip.
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    parseAndApplyCollectorPreferencesPatchMock.mockResolvedValue({ ok: true });

    const result = await savePreferencesAction({ ...BASE_PAYLOAD, baseCurrencyCode: "PEN" });

    expect(result).toEqual({ ok: true });
    expect(parseAndApplyCollectorPreferencesPatchMock).toHaveBeenCalledTimes(1);
    expect(parseAndApplyCollectorPreferencesPatchMock).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ baseCurrencyCode: "PEN" }),
    );
  });

  it("maps a validation failure from the data layer to the validation error code", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    parseAndApplyCollectorPreferencesPatchMock.mockResolvedValue({ ok: false, error: new ZodError([]) });

    const result = await savePreferencesAction(BASE_PAYLOAD);

    expect(result).toEqual({ ok: false, error: "validation" });
  });

  it("reports an unexpected error to Sentry and returns generic", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    parseAndApplyCollectorPreferencesPatchMock.mockRejectedValue(new Error("db down"));

    const result = await savePreferencesAction(BASE_PAYLOAD);

    expect(result).toEqual({ ok: false, error: "generic" });
    expect(captureExceptionMock).toHaveBeenCalled();
  });
});

describe("updateLanguageAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieStoreSetMock.mockClear();
    cookiesMock.mockResolvedValue({ set: cookieStoreSetMock });
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    updateUserLocaleMock.mockResolvedValue(undefined);
  });

  it("rejects a locale outside the es/en union", async () => {
    const result = await updateLanguageAction("fr");

    expect(result).toEqual({ ok: false, error: "validation" });
    expect(cookieStoreSetMock).not.toHaveBeenCalled();
    expect(updateUserLocaleMock).not.toHaveBeenCalled();
  });

  it("rejects an empty locale", async () => {
    const result = await updateLanguageAction("");

    expect(result).toEqual({ ok: false, error: "validation" });
  });

  it("persists a valid locale to the NEXT_LOCALE cookie and to the collector when authenticated", async () => {
    const result = await updateLanguageAction("en");

    expect(result).toEqual({ ok: true, locale: "en" });
    expect(updateUserLocaleMock).toHaveBeenCalledWith("user-1", "en");
    expect(cookieStoreSetMock).toHaveBeenCalledWith(expect.objectContaining({ name: "NEXT_LOCALE", value: "en" }));
  });

  it("stays cookie-only and still succeeds when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);

    const result = await updateLanguageAction("en");

    expect(result).toEqual({ ok: true, locale: "en" });
    expect(updateUserLocaleMock).not.toHaveBeenCalled();
    expect(cookieStoreSetMock).toHaveBeenCalledWith(expect.objectContaining({ name: "NEXT_LOCALE", value: "en" }));
  });

  it("reports an unexpected persistence failure to Sentry and returns generic", async () => {
    updateUserLocaleMock.mockRejectedValueOnce(new Error("db down"));

    const result = await updateLanguageAction("en");

    expect(result).toEqual({ ok: false, error: "generic" });
    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
    expect(cookieStoreSetMock).not.toHaveBeenCalled();
  });
});
