import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SettingsProfilePane from "../SettingsProfilePane";

const {
  saveDisplayNameActionMock,
  saveUsernameActionMock,
  checkUsernameAvailabilityActionMock,
  saveAvatarActionMock,
  removeAvatarActionMock,
  addToastMock,
} = vi.hoisted(() => ({
  saveDisplayNameActionMock: vi.fn(),
  saveUsernameActionMock: vi.fn(),
  checkUsernameAvailabilityActionMock: vi.fn(),
  saveAvatarActionMock: vi.fn(),
  removeAvatarActionMock: vi.fn(),
  addToastMock: vi.fn(),
}));

vi.mock("@/app/[locale]/(app)/settings/_actions/profileActions", () => ({
  saveDisplayNameAction: saveDisplayNameActionMock,
  saveUsernameAction: saveUsernameActionMock,
  checkUsernameAvailabilityAction: checkUsernameAvailabilityActionMock,
  saveAvatarAction: saveAvatarActionMock,
  removeAvatarAction: removeAvatarActionMock,
}));

vi.mock("@/contexts/ToastContext", () => ({ useToast: () => ({ addToast: addToastMock }) }));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

type MockModalAction = { label: string; onClick: () => void; disabled?: boolean };

// Mirrors the pattern used by `OrderCancelModal.test.tsx`: stub the canonical `<Modal>` shell so
// this test exercises the parent coordinator's own optimistic-patch/rollback contract, not the
// adaptive dialog/sheet machinery (which has its own tests).
vi.mock("@/components/modules/Modal/Modal", () => ({
  default: ({
    isOpen,
    children,
    primaryAction,
    secondaryAction,
  }: {
    isOpen: boolean;
    children: ReactNode;
    primaryAction: MockModalAction;
    secondaryAction: MockModalAction;
  }) =>
    isOpen ? (
      <div>
        {children}
        <button type="button" onClick={primaryAction.onClick} disabled={primaryAction.disabled}>
          {primaryAction.label}
        </button>
        <button type="button" onClick={secondaryAction.onClick} disabled={secondaryAction.disabled}>
          {secondaryAction.label}
        </button>
      </div>
    ) : null,
}));

// AvatarModal's own submit contract (file selection, cropping, the preview-URL preload race) is
// covered in isolation by `AvatarModal.test.tsx`. Here we only need to drive the parent's
// optimistic-patch/rollback/reconcile handler, so a minimal stub exposes it directly.
vi.mock("../AvatarModal", () => ({
  default: ({
    isOpen,
    onClose,
    onSubmit,
  }: {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (payload: { formData: FormData; previewUrl: string | null }) => void;
  }) =>
    isOpen ? (
      <button
        type="button"
        onClick={() => {
          onSubmit({ formData: new FormData(), previewUrl: "blob:mock-preview" });
          onClose();
        }}
      >
        simulate-avatar-submit
      </button>
    ) : null,
}));

/**
 * Asserts the rendered avatar `<img>` resolves to `expectedUrl`. Next's `Image` proxies real
 * http(s) URLs through its optimization loader (`/_next/image?url=...`) but leaves `blob:`/`data:`
 * URLs untouched (`get-img-props.js` auto-sets `unoptimized` for those), so the assertion accepts
 * either form.
 */
function expectAvatarSrc(expectedUrl: string) {
  const img = document.querySelector("img");
  const src = img?.getAttribute("src") ?? "";
  if (src === expectedUrl) return;
  expect(src).toContain(encodeURIComponent(expectedUrl));
}

/** A promise the test can resolve/reject on demand, to observe state before the server responds. */
function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const BASE_PROPS = {
  initialUsername: "olduser",
  initialDisplayName: "Old Name",
  initialImageUrl: null as string | null,
  initialUsernameChangedAt: null as Date | null,
};

describe("SettingsProfilePane optimistic coordinators", () => {
  beforeEach(() => {
    saveDisplayNameActionMock.mockReset();
    saveUsernameActionMock.mockReset();
    checkUsernameAvailabilityActionMock.mockReset().mockResolvedValue({ available: true });
    saveAvatarActionMock.mockReset();
    removeAvatarActionMock.mockReset();
    addToastMock.mockReset();
  });

  describe("display name flow", () => {
    it("closes synchronously and shows the new name immediately, before the server responds", async () => {
      const user = userEvent.setup();
      const deferred = createDeferred<{ ok: true; name: string }>();
      saveDisplayNameActionMock.mockReturnValue(deferred.promise);

      render(<SettingsProfilePane {...BASE_PROPS} />);
      const editButtons = screen.getAllByRole("button", { name: "account.email.changeButton" });
      await user.click(editButtons[1]); // display name row's edit button

      const input = screen.getByLabelText("profile.displayName.modal.label");
      await user.clear(input);
      await user.type(input, "New Name");
      await user.click(screen.getByRole("button", { name: "profile.displayName.modal.save" }));

      // Modal gone immediately, action still in flight.
      expect(screen.queryByRole("button", { name: "profile.displayName.modal.save" })).not.toBeInTheDocument();
      expect(screen.getByText("New Name")).toBeInTheDocument();
      expect(saveDisplayNameActionMock).toHaveBeenCalledWith("New Name");

      deferred.resolve({ ok: true, name: "New Name" });
      await waitFor(() => expect(saveDisplayNameActionMock).toHaveBeenCalledTimes(1));
      expect(addToastMock).not.toHaveBeenCalled();
    });

    it("reverts the name and toasts on an ok:false failure", async () => {
      const user = userEvent.setup();
      saveDisplayNameActionMock.mockResolvedValue({ ok: false, error: "validation" });

      render(<SettingsProfilePane {...BASE_PROPS} />);
      const editButtons = screen.getAllByRole("button", { name: "account.email.changeButton" });
      await user.click(editButtons[1]);
      const input = screen.getByLabelText("profile.displayName.modal.label");
      await user.clear(input);
      await user.type(input, "New Name");
      await user.click(screen.getByRole("button", { name: "profile.displayName.modal.save" }));

      await waitFor(() => expect(screen.getByText("Old Name")).toBeInTheDocument());
      expect(screen.queryByText("New Name")).not.toBeInTheDocument();
      expect(addToastMock).toHaveBeenCalledWith("profile.errors.validation", { variant: "error" });
    });

    it("reverts the name and toasts a generic error when the action promise rejects", async () => {
      const user = userEvent.setup();
      saveDisplayNameActionMock.mockRejectedValue(new Error("network down"));

      render(<SettingsProfilePane {...BASE_PROPS} />);
      const editButtons = screen.getAllByRole("button", { name: "account.email.changeButton" });
      await user.click(editButtons[1]);
      const input = screen.getByLabelText("profile.displayName.modal.label");
      await user.clear(input);
      await user.type(input, "New Name");
      await user.click(screen.getByRole("button", { name: "profile.displayName.modal.save" }));

      await waitFor(() => expect(screen.getByText("Old Name")).toBeInTheDocument());
      expect(addToastMock).toHaveBeenCalledWith("profile.errors.generic", { variant: "error" });
    });
  });

  describe("username flow", () => {
    it("closes synchronously and shows the new username with an immediate cooldown chip", async () => {
      const user = userEvent.setup();
      const deferred = createDeferred<{ ok: true; username: string }>();
      saveUsernameActionMock.mockReturnValue(deferred.promise);

      render(<SettingsProfilePane {...BASE_PROPS} />);
      const editButtons = screen.getAllByRole("button", { name: "account.email.changeButton" });
      await user.click(editButtons[0]); // username row's edit button

      const input = screen.getByLabelText("profile.username.modal.label");
      await user.clear(input);
      await user.type(input, "newuser");
      await user.click(screen.getByRole("button", { name: "profile.username.modal.save" }));

      expect(screen.queryByRole("button", { name: "profile.username.modal.save" })).not.toBeInTheDocument();
      expect(screen.getByText("@newuser")).toBeInTheDocument();
      // The cooldown the change starts must be visible immediately, not just the new username.
      expect(screen.getByText('profile.username.cooldown.chipDays:{"days":7}')).toBeInTheDocument();
      expect(saveUsernameActionMock).toHaveBeenCalledWith("newuser");

      deferred.resolve({ ok: true, username: "newuser" });
      await waitFor(() => expect(saveUsernameActionMock).toHaveBeenCalledTimes(1));
      expect(addToastMock).not.toHaveBeenCalled();
    });

    it("reverts BOTH the username and the cooldown, and includes the formatted date, on a rateLimited failure", async () => {
      const user = userEvent.setup();
      const retryAfterIso = "2026-09-05T00:00:00.000Z";
      saveUsernameActionMock.mockResolvedValue({ ok: false, error: "rateLimited", retryAfterIso });

      render(<SettingsProfilePane {...BASE_PROPS} />);
      const editButtons = screen.getAllByRole("button", { name: "account.email.changeButton" });
      await user.click(editButtons[0]);
      const input = screen.getByLabelText("profile.username.modal.label");
      await user.clear(input);
      await user.type(input, "newuser");
      await user.click(screen.getByRole("button", { name: "profile.username.modal.save" }));

      await waitFor(() => expect(screen.getByText("@olduser")).toBeInTheDocument());
      // The cooldown chip the optimistic patch showed must revert too — no lingering cooldown.
      expect(screen.queryByText(/cooldown\.chipDays/)).not.toBeInTheDocument();
      const expectedDate = new Date(retryAfterIso).toLocaleDateString();
      expect(addToastMock).toHaveBeenCalledWith(`profile.errors.rateLimited:{"date":"${expectedDate}"}`, {
        variant: "error",
      });
    });

    it("reverts the pair and toasts usernameTaken when the server rejects despite the live availability check", async () => {
      const user = userEvent.setup();
      saveUsernameActionMock.mockResolvedValue({ ok: false, error: "usernameTaken" });

      render(<SettingsProfilePane {...BASE_PROPS} />);
      const editButtons = screen.getAllByRole("button", { name: "account.email.changeButton" });
      await user.click(editButtons[0]);
      const input = screen.getByLabelText("profile.username.modal.label");
      await user.clear(input);
      await user.type(input, "newuser");
      await user.click(screen.getByRole("button", { name: "profile.username.modal.save" }));

      await waitFor(() => expect(screen.getByText("@olduser")).toBeInTheDocument());
      expect(addToastMock).toHaveBeenCalledWith("profile.errors.usernameTaken", { variant: "error" });
    });

    it("reverts the pair and toasts a generic error when the action promise rejects", async () => {
      const user = userEvent.setup();
      saveUsernameActionMock.mockRejectedValue(new Error("network down"));

      render(<SettingsProfilePane {...BASE_PROPS} />);
      const editButtons = screen.getAllByRole("button", { name: "account.email.changeButton" });
      await user.click(editButtons[0]);
      const input = screen.getByLabelText("profile.username.modal.label");
      await user.clear(input);
      await user.type(input, "newuser");
      await user.click(screen.getByRole("button", { name: "profile.username.modal.save" }));

      await waitFor(() => expect(screen.getByText("@olduser")).toBeInTheDocument());
      expect(addToastMock).toHaveBeenCalledWith("profile.errors.generic", { variant: "error" });
    });
  });

  describe("avatar remove flow", () => {
    it("closes synchronously and clears the avatar immediately, before the server responds", async () => {
      const user = userEvent.setup();
      const deferred = createDeferred<{ ok: true }>();
      removeAvatarActionMock.mockReturnValue(deferred.promise);

      render(<SettingsProfilePane {...BASE_PROPS} initialImageUrl="https://example.com/avatar.png" />);
      await user.click(screen.getByRole("button", { name: "profile.avatar.removeCta" }));
      await user.click(screen.getByRole("button", { name: "profile.avatar.removeModal.confirm" }));

      expect(screen.queryByRole("button", { name: "profile.avatar.removeModal.confirm" })).not.toBeInTheDocument();
      expect(screen.getByText("profile.avatar.initialFallback")).toBeInTheDocument();

      deferred.resolve({ ok: true });
      await waitFor(() => expect(removeAvatarActionMock).toHaveBeenCalledTimes(1));
      expect(addToastMock).not.toHaveBeenCalled();
    });

    it("reverts the avatar and toasts on an ok:false failure", async () => {
      const user = userEvent.setup();
      removeAvatarActionMock.mockResolvedValue({ ok: false, error: "generic" });

      render(<SettingsProfilePane {...BASE_PROPS} initialImageUrl="https://example.com/avatar.png" />);
      await user.click(screen.getByRole("button", { name: "profile.avatar.removeCta" }));
      await user.click(screen.getByRole("button", { name: "profile.avatar.removeModal.confirm" }));

      await waitFor(() => expect(screen.queryByText("profile.avatar.initialFallback")).not.toBeInTheDocument());
      expect(addToastMock).toHaveBeenCalledWith("profile.errors.generic", { variant: "error" });
    });

    it("reverts the avatar and toasts a generic error when the action promise rejects", async () => {
      const user = userEvent.setup();
      removeAvatarActionMock.mockRejectedValue(new Error("network down"));

      render(<SettingsProfilePane {...BASE_PROPS} initialImageUrl="https://example.com/avatar.png" />);
      await user.click(screen.getByRole("button", { name: "profile.avatar.removeCta" }));
      await user.click(screen.getByRole("button", { name: "profile.avatar.removeModal.confirm" }));

      await waitFor(() => expect(screen.queryByText("profile.avatar.initialFallback")).not.toBeInTheDocument());
      expect(addToastMock).toHaveBeenCalledWith("profile.errors.generic", { variant: "error" });
    });
  });

  describe("avatar upload flow", () => {
    it("shows the optimistic preview immediately and reconciles with the server image, revoking the preview URL", async () => {
      const user = userEvent.setup();
      const revokeSpy = vi.fn();
      URL.revokeObjectURL = revokeSpy;
      const deferred = createDeferred<{ ok: true; imageUrl: string }>();
      saveAvatarActionMock.mockReturnValue(deferred.promise);

      render(<SettingsProfilePane {...BASE_PROPS} />);
      await user.click(screen.getByRole("button", { name: "profile.avatar.changeCta" }));
      await user.click(screen.getByRole("button", { name: "simulate-avatar-submit" }));

      expect(screen.queryByRole("button", { name: "simulate-avatar-submit" })).not.toBeInTheDocument();
      expectAvatarSrc("blob:mock-preview");
      expect(revokeSpy).not.toHaveBeenCalled();

      deferred.resolve({ ok: true, imageUrl: "https://cdn.example.com/final.png" });
      await waitFor(() => expectAvatarSrc("https://cdn.example.com/final.png"));
      expect(revokeSpy).toHaveBeenCalledWith("blob:mock-preview");
      expect(addToastMock).not.toHaveBeenCalled();
    });

    it("reverts to the previous avatar, toasts, and still revokes the preview URL on failure", async () => {
      const user = userEvent.setup();
      const revokeSpy = vi.fn();
      URL.revokeObjectURL = revokeSpy;
      saveAvatarActionMock.mockResolvedValue({ ok: false, error: "avatarProcessingFailed" });

      render(<SettingsProfilePane {...BASE_PROPS} initialImageUrl="https://example.com/old.png" />);
      await user.click(screen.getByRole("button", { name: "profile.avatar.replaceCta" }));
      await user.click(screen.getByRole("button", { name: "simulate-avatar-submit" }));

      await waitFor(() => expectAvatarSrc("https://example.com/old.png"));
      expect(revokeSpy).toHaveBeenCalledWith("blob:mock-preview");
      expect(addToastMock).toHaveBeenCalledWith("profile.errors.avatarProcessingFailed", { variant: "error" });
    });

    it("reverts to the previous avatar and toasts a generic error when the action promise rejects", async () => {
      const user = userEvent.setup();
      const revokeSpy = vi.fn();
      URL.revokeObjectURL = revokeSpy;
      saveAvatarActionMock.mockRejectedValue(new Error("network down"));

      render(<SettingsProfilePane {...BASE_PROPS} initialImageUrl="https://example.com/old.png" />);
      await user.click(screen.getByRole("button", { name: "profile.avatar.replaceCta" }));
      await user.click(screen.getByRole("button", { name: "simulate-avatar-submit" }));

      await waitFor(() => expectAvatarSrc("https://example.com/old.png"));
      expect(revokeSpy).toHaveBeenCalledWith("blob:mock-preview");
      expect(addToastMock).toHaveBeenCalledWith("profile.errors.generic", { variant: "error" });
    });
  });
});
