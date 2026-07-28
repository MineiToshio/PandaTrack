import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSessionMock,
  getIsAdminMock,
  getPostHogClientMock,
  getEditableStoreBySlugMock,
  getStoreGovernanceViewerContextMock,
  updateStoreEditableFieldsMock,
  upsertStoreChangeRequestMock,
  revalidatePathMock,
  redirectMock,
  unstableRethrowMock,
  captureExceptionMock,
  safeParseMock,
} = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  getIsAdminMock: vi.fn(),
  getPostHogClientMock: vi.fn(() => ({ capture: vi.fn(), shutdown: vi.fn() })),
  getEditableStoreBySlugMock: vi.fn(),
  getStoreGovernanceViewerContextMock: vi.fn(),
  updateStoreEditableFieldsMock: vi.fn(),
  upsertStoreChangeRequestMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  redirectMock: vi.fn(),
  unstableRethrowMock: vi.fn(),
  captureExceptionMock: vi.fn(),
  safeParseMock: vi.fn(),
}));

vi.mock("@/lib/auth/auth-server", () => ({ getSession: getSessionMock, getIsAdmin: getIsAdminMock }));

vi.mock("@/lib/analytics/posthog-server", () => ({ getPostHogClient: getPostHogClientMock }));

vi.mock("@/lib/data/stores/storeGovernanceQueries", () => ({
  getEditableStoreBySlug: getEditableStoreBySlugMock,
  getStoreGovernanceViewerContext: getStoreGovernanceViewerContextMock,
}));

vi.mock("@/lib/data/stores/storeGovernanceMutations", () => ({
  updateStoreEditableFields: updateStoreEditableFieldsMock,
  upsertStoreChangeRequest: upsertStoreChangeRequestMock,
}));

vi.mock("@/lib/store/logo", () => ({
  getPendingStoreLogoObjectKey: vi.fn(),
  getStoreLogoObjectKey: vi.fn(),
  processStoreLogoFile: vi.fn(),
  StoreLogoError: class StoreLogoError extends Error {},
}));

vi.mock("@/lib/store/logoStorage", () => ({
  deleteStoreLogoObject: vi.fn(),
  uploadStoreLogoBuffer: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    redirectMock(url);
    throw new Error("NEXT_REDIRECT");
  },
  unstable_rethrow: (error: unknown) => {
    unstableRethrowMock(error);
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
  },
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: captureExceptionMock,
  withScope: (callback: (scope: unknown) => void) => callback({ setTag: vi.fn(), setContext: vi.fn() }),
}));

vi.mock("../../_schemas/editStoreSchema", () => ({ editStoreSchema: { safeParse: safeParseMock } }));

import { saveStoreEdit } from "../saveStoreEdit";

const AUTHENTICATED_SESSION = { user: { id: "user-1" } };

const PARSED_DATA = {
  slug: "acme",
  locale: "en",
  name: "Acme",
  description: undefined,
  sellerType: "PERSON",
  countryCode: "US",
  presenceTypes: ["online"],
  productTypeKeys: ["figures"],
  hasStock: undefined,
  receivesOrders: undefined,
  isPrivate: undefined,
  isActive: true,
  contactChannels: [],
  addresses: [],
  importCountries: [],
  logoAction: "keep",
  comment: undefined,
};

const EDITABLE_PERSON_STORE = {
  id: "store-1",
  slug: "acme",
  sellerType: "PERSON",
  status: "PENDING",
  createdByUserId: "user-1",
  logoUrl: null,
};

function primeDirectEditPath() {
  getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
  getIsAdminMock.mockReturnValue(true);
  safeParseMock.mockReturnValue({ success: true, data: PARSED_DATA });
  getEditableStoreBySlugMock.mockResolvedValue(EDITABLE_PERSON_STORE);
  getStoreGovernanceViewerContextMock.mockResolvedValue({ openChangeRequest: null });
}

describe("saveStoreEdit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPostHogClientMock.mockReturnValue({ capture: vi.fn(), shutdown: vi.fn() });
  });

  it("rejects when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);

    const result = await saveStoreEdit(null, new FormData());

    expect(result).toEqual({ success: false, error: "unauthorized" });
  });

  it("captures an unexpected write failure once and returns the generic error", async () => {
    primeDirectEditPath();
    const unexpected = new Error("db down");
    updateStoreEditableFieldsMock.mockRejectedValue(unexpected);

    const result = await saveStoreEdit(null, new FormData());

    expect(result).toEqual({ success: false, error: "saveEditFailed" });
    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
    expect(captureExceptionMock).toHaveBeenCalledWith(unexpected);
  });

  it("re-throws the redirect control-flow signal without capturing it", async () => {
    primeDirectEditPath();
    updateStoreEditableFieldsMock.mockResolvedValue(undefined);

    await expect(saveStoreEdit(null, new FormData())).rejects.toThrow("NEXT_REDIRECT");

    expect(redirectMock).toHaveBeenCalledWith("/en/stores/acme");
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it("threads a closure through the direct-edit payload when the store is marked closed", async () => {
    primeDirectEditPath();
    safeParseMock.mockReturnValue({ success: true, data: { ...PARSED_DATA, isActive: false } });
    updateStoreEditableFieldsMock.mockResolvedValue(undefined);

    await expect(saveStoreEdit(null, new FormData())).rejects.toThrow("NEXT_REDIRECT");

    expect(updateStoreEditableFieldsMock).toHaveBeenCalledWith(
      EDITABLE_PERSON_STORE,
      expect.objectContaining({ isActive: false }),
    );
    expect(upsertStoreChangeRequestMock).not.toHaveBeenCalled();
  });

  it("threads a closure through the change-request payload for non-privileged editors", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    getIsAdminMock.mockReturnValue(false);
    safeParseMock.mockReturnValue({ success: true, data: { ...PARSED_DATA, isActive: false } });
    getEditableStoreBySlugMock.mockResolvedValue({ ...EDITABLE_PERSON_STORE, status: "APPROVED" });
    getStoreGovernanceViewerContextMock.mockResolvedValue({ openChangeRequest: null });
    upsertStoreChangeRequestMock.mockResolvedValue({
      status: "saved",
      changeRequestId: "cr-1",
      changedFieldCount: 1,
    });

    await expect(saveStoreEdit(null, new FormData())).rejects.toThrow("NEXT_REDIRECT");

    expect(updateStoreEditableFieldsMock).not.toHaveBeenCalled();
    expect(upsertStoreChangeRequestMock).toHaveBeenCalledWith(
      { ...EDITABLE_PERSON_STORE, status: "APPROVED" },
      "user-1",
      expect.objectContaining({ isActive: false }),
      undefined,
    );
  });
});
