import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSessionMock,
  findUserIdByUsernameMock,
  getUserProfileSnapshotMock,
  updateUserDisplayNameMock,
  updateUserImageMock,
  updateUserUsernameMock,
  assertUsernameChangeCooldownAllowsMock,
  recordSuccessfulUsernameChangeMock,
  processAvatarFileMock,
  uploadUserAvatarBufferMock,
  deleteUserAvatarObjectMock,
  captureExceptionMock,
  AvatarProcessingErrorMock,
} = vi.hoisted(() => {
  // Redeclared here (instead of importing the real module) because the real
  // `avatarProcessing` module imports `server-only` and `sharp`, which this
  // jsdom-based unit test does not need and should not have to resolve.
  class AvatarProcessingError extends Error {
    constructor(
      public readonly code: string,
      message?: string,
    ) {
      super(message ?? code);
      this.name = "AvatarProcessingError";
    }
  }

  return {
    getSessionMock: vi.fn(),
    findUserIdByUsernameMock: vi.fn(),
    getUserProfileSnapshotMock: vi.fn(),
    updateUserDisplayNameMock: vi.fn(),
    updateUserImageMock: vi.fn(),
    updateUserUsernameMock: vi.fn(),
    assertUsernameChangeCooldownAllowsMock: vi.fn(),
    recordSuccessfulUsernameChangeMock: vi.fn(),
    processAvatarFileMock: vi.fn(),
    uploadUserAvatarBufferMock: vi.fn(),
    deleteUserAvatarObjectMock: vi.fn(),
    captureExceptionMock: vi.fn(),
    AvatarProcessingErrorMock: AvatarProcessingError,
  };
});

vi.mock("@/lib/auth/auth-server", () => ({ getSession: getSessionMock }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@sentry/nextjs", () => ({ captureException: captureExceptionMock }));

vi.mock("@/lib/data/auth/userQueries", () => ({
  findUserIdByUsername: findUserIdByUsernameMock,
  getUserProfileSnapshot: getUserProfileSnapshotMock,
}));

vi.mock("@/lib/data/auth/userMutations", () => ({
  updateUserDisplayName: updateUserDisplayNameMock,
  updateUserImage: updateUserImageMock,
  updateUserUsername: updateUserUsernameMock,
}));

vi.mock("@/lib/auth/usernameChangeCooldown", () => ({
  assertUsernameChangeCooldownAllows: assertUsernameChangeCooldownAllowsMock,
  recordSuccessfulUsernameChange: recordSuccessfulUsernameChangeMock,
}));

vi.mock("@/lib/user/avatarProcessing", () => ({
  processAvatarFile: processAvatarFileMock,
  AvatarProcessingError: AvatarProcessingErrorMock,
}));

vi.mock("@/lib/user/avatarStorage", () => ({
  uploadUserAvatarBuffer: uploadUserAvatarBufferMock,
  deleteUserAvatarObject: deleteUserAvatarObjectMock,
}));

import {
  checkUsernameAvailabilityAction,
  getProfileSnapshotAction,
  removeAvatarAction,
  saveAvatarAction,
  saveDisplayNameAction,
  saveUsernameAction,
} from "../profileActions";

const AUTHENTICATED_SESSION = { user: { id: "user-1" } };

function buildAvatarFormData(overrides: Partial<Record<string, string>> = {}): FormData {
  const formData = new FormData();
  formData.set("file", new File(["fake-image-bytes"], "avatar.png", { type: "image/png" }));
  formData.set("cropX", "0");
  formData.set("cropY", "0");
  formData.set("cropWidth", "100");
  formData.set("cropHeight", "100");
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      formData.delete(key);
    } else {
      formData.set(key, value);
    }
  }
  return formData;
}

describe("checkUsernameAvailabilityAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports unavailable when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);

    const result = await checkUsernameAvailabilityAction("collector-1");

    expect(result).toEqual({ available: false });
    expect(findUserIdByUsernameMock).not.toHaveBeenCalled();
  });

  it("reports unavailable for a candidate that fails format validation", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);

    const result = await checkUsernameAvailabilityAction("a");

    expect(result).toEqual({ available: false });
    expect(findUserIdByUsernameMock).not.toHaveBeenCalled();
  });

  it("reports available when no other account owns the normalized username", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    findUserIdByUsernameMock.mockResolvedValue(null);

    const result = await checkUsernameAvailabilityAction("Collector-1");

    expect(result).toEqual({ available: true });
    expect(findUserIdByUsernameMock).toHaveBeenCalledWith("collector-1");
  });

  it("reports available when the candidate is already owned by the caller", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    findUserIdByUsernameMock.mockResolvedValue({ id: "user-1" });

    const result = await checkUsernameAvailabilityAction("collector-1");

    expect(result).toEqual({ available: true });
  });

  it("reports unavailable when another account owns the username", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    findUserIdByUsernameMock.mockResolvedValue({ id: "someone-else" });

    const result = await checkUsernameAvailabilityAction("collector-1");

    expect(result).toEqual({ available: false });
  });
});

describe("saveUsernameAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    assertUsernameChangeCooldownAllowsMock.mockResolvedValue({ ok: true });
  });

  it("rejects when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);

    const result = await saveUsernameAction("collector-1");

    expect(result).toEqual({ ok: false, error: "unauthorized" });
    expect(updateUserUsernameMock).not.toHaveBeenCalled();
  });

  it("rejects a username that fails format validation", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);

    const result = await saveUsernameAction("a");

    expect(result).toEqual({ ok: false, error: "validation" });
    expect(updateUserUsernameMock).not.toHaveBeenCalled();
  });

  it("rejects the change while inside the rename cooldown window", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    assertUsernameChangeCooldownAllowsMock.mockResolvedValue({ ok: false, retryAfterIso: "2026-08-01T00:00:00.000Z" });

    const result = await saveUsernameAction("collector-1");

    expect(result).toEqual({ ok: false, error: "rateLimited", retryAfterIso: "2026-08-01T00:00:00.000Z" });
    expect(updateUserUsernameMock).not.toHaveBeenCalled();
  });

  it("rejects a username already taken by another account", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    findUserIdByUsernameMock.mockResolvedValue({ id: "someone-else" });

    const result = await saveUsernameAction("collector-1");

    expect(result).toEqual({ ok: false, error: "usernameTaken" });
    expect(updateUserUsernameMock).not.toHaveBeenCalled();
  });

  it("short-circuits without a write when the caller already owns the username", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    findUserIdByUsernameMock.mockResolvedValue({ id: "user-1" });

    const result = await saveUsernameAction("collector-1");

    expect(result).toEqual({ ok: true, username: "collector-1" });
    expect(updateUserUsernameMock).not.toHaveBeenCalled();
    expect(recordSuccessfulUsernameChangeMock).not.toHaveBeenCalled();
  });

  it("saves the new username and records the cooldown on success", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    findUserIdByUsernameMock.mockResolvedValue(null);

    const result = await saveUsernameAction("Collector-1");

    expect(result).toEqual({ ok: true, username: "collector-1" });
    expect(updateUserUsernameMock).toHaveBeenCalledWith("user-1", "collector-1");
    expect(recordSuccessfulUsernameChangeMock).toHaveBeenCalledWith("user-1", expect.any(Date));
  });
});

describe("saveDisplayNameAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);

    const result = await saveDisplayNameAction("Ash Ketchum");

    expect(result).toEqual({ ok: false, error: "unauthorized" });
    expect(updateUserDisplayNameMock).not.toHaveBeenCalled();
  });

  it("rejects an empty display name", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);

    const result = await saveDisplayNameAction("   ");

    expect(result).toEqual({ ok: false, error: "validation" });
    expect(updateUserDisplayNameMock).not.toHaveBeenCalled();
  });

  it("saves the trimmed display name on success", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);

    const result = await saveDisplayNameAction("  Ash Ketchum  ");

    expect(result).toEqual({ ok: true, name: "Ash Ketchum" });
    expect(updateUserDisplayNameMock).toHaveBeenCalledWith("user-1", "Ash Ketchum");
  });
});

describe("saveAvatarAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);

    const result = await saveAvatarAction(buildAvatarFormData());

    expect(result).toEqual({ ok: false, error: "unauthorized" });
    expect(processAvatarFileMock).not.toHaveBeenCalled();
  });

  it("rejects a payload missing the uploaded file", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);

    const result = await saveAvatarAction(buildAvatarFormData({ file: undefined }));

    expect(result).toEqual({ ok: false, error: "avatarMalformed" });
    expect(processAvatarFileMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed crop area", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);

    const result = await saveAvatarAction(buildAvatarFormData({ cropWidth: "-10" }));

    expect(result).toEqual({ ok: false, error: "avatarMalformed" });
    expect(processAvatarFileMock).not.toHaveBeenCalled();
  });

  it("maps a known avatar processing failure to its error code", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    processAvatarFileMock.mockRejectedValue(new AvatarProcessingErrorMock("avatarInvalidType"));

    const result = await saveAvatarAction(buildAvatarFormData());

    expect(result).toEqual({ ok: false, error: "avatarInvalidType" });
    expect(uploadUserAvatarBufferMock).not.toHaveBeenCalled();
  });

  it("reports an unexpected processing error to Sentry as avatarProcessingFailed", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    processAvatarFileMock.mockRejectedValue(new Error("sharp exploded"));

    const result = await saveAvatarAction(buildAvatarFormData());

    expect(result).toEqual({ ok: false, error: "avatarProcessingFailed" });
    expect(captureExceptionMock).toHaveBeenCalled();
  });

  it("uploads the processed avatar and updates the user image on success", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    processAvatarFileMock.mockResolvedValue(Buffer.from("webp-bytes"));
    uploadUserAvatarBufferMock.mockResolvedValue("https://cdn.example.com/avatar.webp");

    const result = await saveAvatarAction(buildAvatarFormData());

    expect(result).toEqual({ ok: true, imageUrl: "https://cdn.example.com/avatar.webp" });
    expect(updateUserImageMock).toHaveBeenCalledWith("user-1", "https://cdn.example.com/avatar.webp");
  });

  it("returns generic when the storage upload fails", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    processAvatarFileMock.mockResolvedValue(Buffer.from("webp-bytes"));
    uploadUserAvatarBufferMock.mockRejectedValue(new Error("R2 down"));

    const result = await saveAvatarAction(buildAvatarFormData());

    expect(result).toEqual({ ok: false, error: "generic" });
    expect(updateUserImageMock).not.toHaveBeenCalled();
    expect(captureExceptionMock).toHaveBeenCalled();
  });
});

describe("removeAvatarAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);

    const result = await removeAvatarAction();

    expect(result).toEqual({ ok: false, error: "unauthorized" });
    expect(updateUserImageMock).not.toHaveBeenCalled();
  });

  it("clears the user image and still reports success when R2 cleanup fails", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    deleteUserAvatarObjectMock.mockRejectedValue(new Error("R2 cleanup failed"));

    const result = await removeAvatarAction();

    expect(result).toEqual({ ok: true });
    expect(updateUserImageMock).toHaveBeenCalledWith("user-1", null);
    expect(captureExceptionMock).toHaveBeenCalled();
  });
});

describe("getProfileSnapshotAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);

    const result = await getProfileSnapshotAction();

    expect(result).toBeNull();
    expect(getUserProfileSnapshotMock).not.toHaveBeenCalled();
  });

  it("returns null when the user profile cannot be found", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    getUserProfileSnapshotMock.mockResolvedValue(null);

    const result = await getProfileSnapshotAction();

    expect(result).toBeNull();
  });

  it("returns the normalized profile snapshot on success", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    getUserProfileSnapshotMock.mockResolvedValue({
      username: "Collector-1",
      name: "Ash Ketchum",
      image: null,
    });

    const result = await getProfileSnapshotAction();

    expect(result).toEqual({ username: "collector-1", name: "Ash Ketchum", image: null });
  });
});
