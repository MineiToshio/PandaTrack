import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSessionMock,
  getIsAdminMock,
  captureMock,
  shutdownMock,
  findDuplicateCandidatesInCountryMock,
  createStoreFromIntakeMock,
  recordConfirmedStoreMatchMock,
  getCollectorPreferencesSnapshotMock,
  captureExceptionMock,
} = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  getIsAdminMock: vi.fn(),
  captureMock: vi.fn(),
  shutdownMock: vi.fn(),
  findDuplicateCandidatesInCountryMock: vi.fn(),
  createStoreFromIntakeMock: vi.fn(),
  recordConfirmedStoreMatchMock: vi.fn(),
  getCollectorPreferencesSnapshotMock: vi.fn(),
  captureExceptionMock: vi.fn(),
}));

vi.mock("@/lib/auth/auth-server", () => ({ getSession: getSessionMock, getIsAdmin: getIsAdminMock }));
vi.mock("@/lib/analytics/posthog-server", () => ({
  getPostHogClient: () => ({ capture: captureMock, shutdown: shutdownMock }),
}));
vi.mock("@/lib/data/stores/storeQueries", () => ({
  findDuplicateCandidatesInCountry: findDuplicateCandidatesInCountryMock,
}));
vi.mock("@/lib/data/stores/storeMatchingMutations", () => ({
  createStoreFromIntake: createStoreFromIntakeMock,
  recordConfirmedStoreMatch: recordConfirmedStoreMatchMock,
}));
vi.mock("@/lib/data/user-settings/userSettingsQueries", () => ({
  getCollectorPreferencesSnapshot: getCollectorPreferencesSnapshotMock,
}));
vi.mock("@sentry/nextjs", () => ({ captureException: captureExceptionMock }));

import { confirmStoreMatchAction, createStoreFromIntakeAction } from "../imageIntakeStoreActions";

const USER_SESSION = { user: { id: "user-1" } };

describe("createStoreFromIntakeAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionMock.mockResolvedValue(USER_SESSION);
    getIsAdminMock.mockReturnValue(false);
    getCollectorPreferencesSnapshotMock.mockResolvedValue({ preferredCountryCode: "PE" });
    findDuplicateCandidatesInCountryMock.mockResolvedValue([]);
    createStoreFromIntakeMock.mockResolvedValue({ id: "store-1", slug: "pop-dealer" });
  });

  it("returns unauthorized without a session", async () => {
    getSessionMock.mockResolvedValue(null);
    const result = await createStoreFromIntakeAction({ name: "Pop Dealer" });
    expect(result).toEqual({ ok: false, code: "unauthorized" });
    expect(createStoreFromIntakeMock).not.toHaveBeenCalled();
  });

  it("returns invalid-input for a blank name", async () => {
    const result = await createStoreFromIntakeAction({ name: "   " });
    expect(result).toEqual({ ok: false, code: "invalid-input" });
  });

  it("returns country-required when the collector has no preferred country", async () => {
    getCollectorPreferencesSnapshotMock.mockResolvedValue({ preferredCountryCode: null });
    const result = await createStoreFromIntakeAction({ name: "Pop Dealer" });
    expect(result).toEqual({ ok: false, code: "country-required" });
    expect(createStoreFromIntakeMock).not.toHaveBeenCalled();
  });

  it("returns possible-duplicate with candidates instead of creating, so it never bypasses the store layer's duplicate protection", async () => {
    findDuplicateCandidatesInCountryMock.mockResolvedValue([
      { id: "store-9", name: "Pop Dealer Store", slug: "pop-dealer-store", countryCode: "PE", logoUrl: null },
    ]);

    const result = await createStoreFromIntakeAction({ name: "Pop Dealer" });

    expect(result).toEqual({
      ok: false,
      code: "possible-duplicate",
      candidates: [{ storeId: "store-9", name: "Pop Dealer Store" }],
    });
    expect(createStoreFromIntakeMock).not.toHaveBeenCalled();
  });

  it("skips the duplicate check and creates when confirmDuplicate is set", async () => {
    findDuplicateCandidatesInCountryMock.mockResolvedValue([
      { id: "store-9", name: "Pop Dealer Store", slug: "pop-dealer-store", countryCode: "PE", logoUrl: null },
    ]);

    const result = await createStoreFromIntakeAction({ name: "Pop Dealer", confirmDuplicate: true });

    expect(result).toEqual({ ok: true, storeId: "store-1", name: "Pop Dealer", status: "PENDING" });
    expect(findDuplicateCandidatesInCountryMock).not.toHaveBeenCalled();
  });

  it("creates a PENDING store for a non-admin and fires STORE_CREATED_INLINE", async () => {
    const result = await createStoreFromIntakeAction({ name: "Pop Dealer", phone: "987654321" });

    expect(result).toEqual({ ok: true, storeId: "store-1", name: "Pop Dealer", status: "PENDING" });
    expect(createStoreFromIntakeMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "PENDING", approvedByUserId: null, countryCode: "PE" }),
    );
    expect(captureMock).toHaveBeenCalledWith(expect.objectContaining({ event: "image_intake_store_created_inline" }));
  });

  it("creates an APPROVED store for an admin", async () => {
    getIsAdminMock.mockReturnValue(true);
    const result = await createStoreFromIntakeAction({ name: "Pop Dealer" });

    expect(result).toEqual({ ok: true, storeId: "store-1", name: "Pop Dealer", status: "APPROVED" });
    expect(createStoreFromIntakeMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "APPROVED", approvedByUserId: "user-1" }),
    );
  });

  it("also fires STORE_AMBIGUITY_RESOLVED when the creation resolves an ambiguous list", async () => {
    await createStoreFromIntakeAction({ name: "Pop Dealer", wasAmbiguous: true });

    expect(captureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "image_intake_store_ambiguity_resolved",
        properties: expect.objectContaining({ resolution: "created_new" }),
      }),
    );
  });

  it("returns server-error and reports to Sentry when the write throws", async () => {
    createStoreFromIntakeMock.mockRejectedValue(new Error("db down"));

    const result = await createStoreFromIntakeAction({ name: "Pop Dealer" });

    expect(result).toEqual({ ok: false, code: "server-error" });
    expect(captureExceptionMock).toHaveBeenCalled();
  });
});

describe("confirmStoreMatchAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionMock.mockResolvedValue(USER_SESSION);
    recordConfirmedStoreMatchMock.mockResolvedValue("recorded");
  });

  it("returns unauthorized without a session", async () => {
    getSessionMock.mockResolvedValue(null);
    const result = await confirmStoreMatchAction({ storeId: "store-1" });
    expect(result).toEqual({ ok: false, code: "unauthorized" });
    expect(recordConfirmedStoreMatchMock).not.toHaveBeenCalled();
  });

  it("returns invalid-input for a missing storeId", async () => {
    const result = await confirmStoreMatchAction({ storeId: "" });
    expect(result).toEqual({ ok: false, code: "invalid-input" });
  });

  it("records the match and stays silent on analytics for a plain correction (no candidateCount)", async () => {
    const result = await confirmStoreMatchAction({ storeId: "store-1", phone: "987654321" });

    expect(result).toEqual({ ok: true, learned: true, outcome: "recorded" });
    expect(captureMock).not.toHaveBeenCalled();
  });

  it("passes the session's own user id to the data layer, never one supplied by the caller", async () => {
    await confirmStoreMatchAction({ storeId: "store-1", phone: "987654321", userId: "someone-else" });

    expect(recordConfirmedStoreMatchMock).toHaveBeenCalledWith({
      userId: "user-1",
      storeId: "store-1",
      phone: "987654321",
    });
  });

  it("accepts the pick but reports that nothing was learned when the caller has no tie to the store", async () => {
    recordConfirmedStoreMatchMock.mockResolvedValue("not-related");

    const result = await confirmStoreMatchAction({ storeId: "someone-elses-store", phone: "987654321" });

    expect(result).toEqual({ ok: true, learned: false, outcome: "not-related" });
  });

  it("reports whether the confirmation fed the matcher on the ambiguity event", async () => {
    recordConfirmedStoreMatchMock.mockResolvedValue("not-related");

    await confirmStoreMatchAction({ storeId: "store-1", phone: "987654321", candidateCount: 2 });

    expect(captureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        properties: expect.objectContaining({ match_learned: false }),
      }),
    );
  });

  it("fires STORE_AMBIGUITY_RESOLVED when resolving an ambiguous pick", async () => {
    const result = await confirmStoreMatchAction({ storeId: "store-1", phone: "987654321", candidateCount: 3 });

    expect(result).toEqual({ ok: true, learned: true, outcome: "recorded" });
    expect(captureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "image_intake_store_ambiguity_resolved",
        properties: expect.objectContaining({ resolution: "candidate_picked", candidate_count: 3 }),
      }),
    );
  });

  it("returns server-error and reports to Sentry when the write throws", async () => {
    recordConfirmedStoreMatchMock.mockRejectedValue(new Error("db down"));

    const result = await confirmStoreMatchAction({ storeId: "store-1" });

    expect(result).toEqual({ ok: false, code: "server-error" });
    expect(captureExceptionMock).toHaveBeenCalled();
  });
});
