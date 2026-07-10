import { ZodError } from "zod";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSessionMock,
  getCollectorPreferencesSnapshotMock,
  parseAndApplyCollectorPreferencesPatchMock,
  applyBaseCurrencyChangeMock,
  cookiesMock,
  cookieStoreSetMock,
  captureExceptionMock,
} = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  getCollectorPreferencesSnapshotMock: vi.fn(),
  parseAndApplyCollectorPreferencesPatchMock: vi.fn(),
  applyBaseCurrencyChangeMock: vi.fn(),
  cookiesMock: vi.fn(),
  cookieStoreSetMock: vi.fn(),
  captureExceptionMock: vi.fn(),
}));

vi.mock("@/lib/auth/auth-server", () => ({ getSession: getSessionMock }));

vi.mock("@/lib/data/user-settings/userSettingsQueries", () => ({
  getCollectorPreferencesSnapshot: getCollectorPreferencesSnapshotMock,
}));

vi.mock("@/lib/data/user-settings/userSettingsMutations", () => ({
  parseAndApplyCollectorPreferencesPatch: parseAndApplyCollectorPreferencesPatchMock,
  applyBaseCurrencyChange: applyBaseCurrencyChangeMock,
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

const BASE_SNAPSHOT = {
  preferredCountryCode: "US",
  baseCurrencyCode: "USD",
  budgetAmount: 10000,
  budgetResetDayOfMonth: 1,
  preferredProductTypeKeys: ["figures"],
};

describe("savePreferencesAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);

    const result = await savePreferencesAction(BASE_PAYLOAD);

    expect(result).toEqual({ ok: false, error: "unauthorized" });
    expect(getCollectorPreferencesSnapshotMock).not.toHaveBeenCalled();
  });

  it("rejects when the current preferences snapshot cannot be loaded", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    getCollectorPreferencesSnapshotMock.mockResolvedValue(null);

    const result = await savePreferencesAction(BASE_PAYLOAD);

    expect(result).toEqual({ ok: false, error: "unauthorized" });
    expect(applyBaseCurrencyChangeMock).not.toHaveBeenCalled();
    expect(parseAndApplyCollectorPreferencesPatchMock).not.toHaveBeenCalled();
  });

  it("routes through applyBaseCurrencyChange when the base currency actually changes", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    getCollectorPreferencesSnapshotMock.mockResolvedValue({ ...BASE_SNAPSHOT, baseCurrencyCode: "EUR" });
    applyBaseCurrencyChangeMock.mockResolvedValue({ ok: true });

    const result = await savePreferencesAction({ ...BASE_PAYLOAD, baseCurrencyCode: "USD" });

    expect(result).toEqual({ ok: true });
    expect(applyBaseCurrencyChangeMock).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ baseCurrencyCode: "USD" }),
      { previousBaseCurrencyCode: "EUR", nextBaseCurrencyCode: "USD" },
    );
    expect(parseAndApplyCollectorPreferencesPatchMock).not.toHaveBeenCalled();
  });

  it("routes through parseAndApplyCollectorPreferencesPatch when the base currency is unchanged", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    getCollectorPreferencesSnapshotMock.mockResolvedValue(BASE_SNAPSHOT);
    parseAndApplyCollectorPreferencesPatchMock.mockResolvedValue({ ok: true });

    const result = await savePreferencesAction(BASE_PAYLOAD);

    expect(result).toEqual({ ok: true });
    expect(parseAndApplyCollectorPreferencesPatchMock).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ baseCurrencyCode: "USD" }),
    );
    expect(applyBaseCurrencyChangeMock).not.toHaveBeenCalled();
  });

  it("maps a validation failure from the data layer to the validation error code", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    getCollectorPreferencesSnapshotMock.mockResolvedValue(BASE_SNAPSHOT);
    parseAndApplyCollectorPreferencesPatchMock.mockResolvedValue({ ok: false, error: new ZodError([]) });

    const result = await savePreferencesAction(BASE_PAYLOAD);

    expect(result).toEqual({ ok: false, error: "validation" });
  });

  it("reports an unexpected error to Sentry and returns generic", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    getCollectorPreferencesSnapshotMock.mockRejectedValue(new Error("db down"));

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
  });

  it("rejects a locale outside the es/en union", async () => {
    const result = await updateLanguageAction("fr");

    expect(result).toEqual({ ok: false, error: "validation" });
    expect(cookieStoreSetMock).not.toHaveBeenCalled();
  });

  it("rejects an empty locale", async () => {
    const result = await updateLanguageAction("");

    expect(result).toEqual({ ok: false, error: "validation" });
  });

  it("persists a valid locale to the NEXT_LOCALE cookie", async () => {
    const result = await updateLanguageAction("en");

    expect(result).toEqual({ ok: true, locale: "en" });
    expect(cookieStoreSetMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "NEXT_LOCALE", value: "en" }),
    );
  });
});
