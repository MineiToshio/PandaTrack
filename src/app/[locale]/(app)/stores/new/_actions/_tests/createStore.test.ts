import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSessionMock,
  getIsAdminMock,
  getPostHogClientMock,
  createStoreQueryMock,
  deleteStoreByIdMock,
  updateStoreLogoUrlMock,
  listExistingCountryCodesMock,
  listExistingStoreProductTypeKeysMock,
  getStoreLogoObjectKeyMock,
  processStoreLogoFileMock,
  uploadStoreLogoBufferMock,
  deleteStoreLogoObjectMock,
  captureExceptionMock,
  safeParseMock,
} = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  getIsAdminMock: vi.fn(),
  getPostHogClientMock: vi.fn(() => ({ capture: vi.fn() })),
  createStoreQueryMock: vi.fn(),
  deleteStoreByIdMock: vi.fn(),
  updateStoreLogoUrlMock: vi.fn(),
  listExistingCountryCodesMock: vi.fn(),
  listExistingStoreProductTypeKeysMock: vi.fn(),
  getStoreLogoObjectKeyMock: vi.fn(),
  processStoreLogoFileMock: vi.fn(),
  uploadStoreLogoBufferMock: vi.fn(),
  deleteStoreLogoObjectMock: vi.fn(),
  captureExceptionMock: vi.fn(),
  safeParseMock: vi.fn(),
}));

vi.mock("@/lib/auth/auth-server", () => ({ getSession: getSessionMock, getIsAdmin: getIsAdminMock }));

vi.mock("@/lib/analytics/posthog-server", () => ({ getPostHogClient: getPostHogClientMock }));

vi.mock("@/lib/data/stores/storeMutations", () => ({
  createStore: createStoreQueryMock,
  deleteStoreById: deleteStoreByIdMock,
  updateStoreLogoUrl: updateStoreLogoUrlMock,
}));

vi.mock("@/lib/data/catalog/countryQueries", () => ({
  listExistingCountryCodes: listExistingCountryCodesMock,
}));

vi.mock("@/lib/data/catalog/storeProductTypeQueries", () => ({
  listExistingStoreProductTypeKeys: listExistingStoreProductTypeKeysMock,
}));

vi.mock("@/lib/store/logo", () => ({
  getStoreLogoObjectKey: getStoreLogoObjectKeyMock,
  processStoreLogoFile: processStoreLogoFileMock,
  StoreLogoError: class StoreLogoError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  },
}));

vi.mock("@/lib/store/logoStorage", () => ({
  uploadStoreLogoBuffer: uploadStoreLogoBufferMock,
  deleteStoreLogoObject: deleteStoreLogoObjectMock,
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: captureExceptionMock,
  withScope: (callback: (scope: unknown) => void) => callback({ setTag: vi.fn(), setContext: vi.fn() }),
}));

vi.mock("../../_schemas/createStoreSchema", () => ({ createStoreSchema: { safeParse: safeParseMock } }));

import { createStore } from "../createStore";

const AUTHENTICATED_SESSION = { user: { id: "user-1" } };

const RETAILER_INPUT_WITH_LOGO = {
  name: "Acme",
  description: undefined,
  sellerType: "RETAILER",
  countryCode: "PE",
  presenceTypes: ["ONLINE"],
  productTypeKeys: [],
  hasStock: undefined,
  receivesOrders: undefined,
  isPrivate: undefined,
  contactChannels: [],
  addresses: [],
  importCountries: [],
  logoAction: "set",
};

function buildFormDataWithLogo(): FormData {
  const formData = new FormData();
  formData.set("logoFile", new File([new Uint8Array([1, 2, 3])], "logo.png", { type: "image/png" }));
  return formData;
}

function primeHappyPathUpToLogoStep() {
  getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
  getIsAdminMock.mockReturnValue(false);
  safeParseMock.mockReturnValue({ success: true, data: RETAILER_INPUT_WITH_LOGO });
  listExistingCountryCodesMock.mockResolvedValue([{ code: "PE" }]);
  listExistingStoreProductTypeKeysMock.mockResolvedValue([]);
  processStoreLogoFileMock.mockResolvedValue(Buffer.from("processed-logo"));
  getStoreLogoObjectKeyMock.mockImplementation((storeId: string) => `logos/${storeId}.webp`);
  createStoreQueryMock.mockResolvedValue({ id: "store-1", slug: "acme" });
}

describe("createStore: R2 logo compensation on a failed create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPostHogClientMock.mockReturnValue({ capture: vi.fn() });
    deleteStoreByIdMock.mockResolvedValue(undefined);
    deleteStoreLogoObjectMock.mockResolvedValue(undefined);
  });

  it("deletes the uploaded R2 object when the logo upload succeeded but persisting its URL failed", async () => {
    primeHappyPathUpToLogoStep();
    uploadStoreLogoBufferMock.mockResolvedValue("https://cdn.pandatrack.app/logos/store-1.webp");
    updateStoreLogoUrlMock.mockRejectedValue(new Error("db write failed"));

    const result = await createStore(null, buildFormDataWithLogo());

    expect(result).toEqual({
      success: false,
      error: "logoUploadFailed",
      fieldErrors: { logo: ["logoUploadFailed"] },
    });
    // The R2 object was actually created before the DB write failed, so leaving it behind orphans
    // it forever: nothing else in the product ever points at a store that was rolled back.
    expect(deleteStoreLogoObjectMock).toHaveBeenCalledWith("logos/store-1.webp");
    expect(deleteStoreByIdMock).toHaveBeenCalledWith("store-1");
  });

  it("does not attempt to delete an R2 object that was never created, when the upload call itself failed", async () => {
    primeHappyPathUpToLogoStep();
    uploadStoreLogoBufferMock.mockRejectedValue(new Error("R2 unreachable"));

    const result = await createStore(null, buildFormDataWithLogo());

    expect(result.success).toBe(false);
    // No object exists at this point, so calling delete on it would just be a pointless request.
    expect(deleteStoreLogoObjectMock).not.toHaveBeenCalled();
    expect(deleteStoreByIdMock).toHaveBeenCalledWith("store-1");
  });

  it("reports a compensation failure to Sentry instead of silently swallowing it", async () => {
    primeHappyPathUpToLogoStep();
    uploadStoreLogoBufferMock.mockResolvedValue("https://cdn.pandatrack.app/logos/store-1.webp");
    updateStoreLogoUrlMock.mockRejectedValue(new Error("db write failed"));
    const cleanupError = new Error("R2 delete failed");
    deleteStoreLogoObjectMock.mockRejectedValue(cleanupError);

    const result = await createStore(null, buildFormDataWithLogo());

    expect(result.success).toBe(false);
    // Two distinct failures must both be visible: the original reason the create failed, and the
    // compensation step that could not clean up after it. A `.catch(() => null)` would report only
    // the first and hide an object now orphaned with no record of it anywhere.
    expect(captureExceptionMock).toHaveBeenCalledWith(cleanupError);
  });

  it("reports a failed store-row compensation delete to Sentry instead of silently swallowing it", async () => {
    primeHappyPathUpToLogoStep();
    uploadStoreLogoBufferMock.mockRejectedValue(new Error("R2 unreachable"));
    const cleanupError = new Error("store delete failed");
    deleteStoreByIdMock.mockRejectedValue(cleanupError);

    const result = await createStore(null, buildFormDataWithLogo());

    expect(result.success).toBe(false);
    expect(captureExceptionMock).toHaveBeenCalledWith(cleanupError);
  });
});
