import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AvatarModal from "../AvatarModal";

const { createCroppedPreviewUrlMock } = vi.hoisted(() => ({
  createCroppedPreviewUrlMock: vi.fn(),
}));

vi.mock("@/app/[locale]/(app)/settings/_utils/cropImagePreview", () => ({
  createCroppedPreviewUrl: createCroppedPreviewUrlMock,
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

type MockModalAction = { label: string; onClick: () => void; disabled?: boolean };

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

type MockCropperBodyProps = {
  zoomLabel: string;
  onCropComplete: (
    croppedArea: { x: number; y: number; width: number; height: number },
    croppedAreaPixels: { x: number; y: number; width: number; height: number },
  ) => void;
};

const CROP_AREA_PIXELS = { x: 5, y: 5, width: 200, height: 200 };

// `react-easy-crop` (behind `CropperBody`) needs browser measurement APIs jsdom doesn't provide.
// Stub the crop surface itself; `useImageCropperState` is plain `useState` logic, safe to keep real.
vi.mock("@/components/modules/ImageCropper", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/modules/ImageCropper")>();
  return {
    ...actual,
    CropperBody: ({ zoomLabel, onCropComplete }: MockCropperBodyProps) => (
      <div>
        <span>{zoomLabel}</span>
        <button type="button" onClick={() => onCropComplete(CROP_AREA_PIXELS, CROP_AREA_PIXELS)}>
          simulate-crop-complete
        </button>
      </div>
    ),
  };
});

/** A same-tick fake so the modal's image preload resolves before the user can click confirm. */
class SyncLoadFakeImage {
  onload: (() => void) | null = null;
  set src(_value: string) {
    this.onload?.();
  }
}

async function openModalAndSelectFile(user: ReturnType<typeof userEvent.setup>, onSubmit = vi.fn()) {
  render(<AvatarModal isOpen onClose={vi.fn()} onSubmit={onSubmit} />);
  const file = new File(["avatar-bytes"], "avatar.png", { type: "image/png" });
  const fileInput = screen.getByLabelText("profile.avatar.modal.title") as HTMLInputElement;
  await user.upload(fileInput, file);
  await user.click(screen.getByRole("button", { name: "simulate-crop-complete" }));
  return onSubmit;
}

describe("AvatarModal submit contract", () => {
  beforeEach(() => {
    createCroppedPreviewUrlMock.mockReset().mockReturnValue("blob:mock-preview");
    vi.stubGlobal("Image", SyncLoadFakeImage);
    URL.createObjectURL = vi.fn(() => "blob:mock-source");
    URL.revokeObjectURL = vi.fn();
  });

  it("calls onSubmit with the cropped preview and closes, without ever dispatching a server call itself", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSubmit = vi.fn();
    render(<AvatarModal isOpen onClose={onClose} onSubmit={onSubmit} />);

    const file = new File(["avatar-bytes"], "avatar.png", { type: "image/png" });
    const fileInput = screen.getByLabelText("profile.avatar.modal.title") as HTMLInputElement;
    await user.upload(fileInput, file);
    await user.click(screen.getByRole("button", { name: "simulate-crop-complete" }));

    await user.click(screen.getByRole("button", { name: "profile.avatar.modal.confirm" }));

    expect(createCroppedPreviewUrlMock).toHaveBeenCalledWith(expect.any(SyncLoadFakeImage), CROP_AREA_PIXELS);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.previewUrl).toBe("blob:mock-preview");
    expect(payload.formData).toBeInstanceOf(FormData);
    expect(payload.formData.get("cropX")).toBe("5");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("still submits with a null preview when the source image has not finished decoding", async () => {
    const user = userEvent.setup();
    // Never resolves onload, simulating a still-decoding image at confirm time.
    vi.stubGlobal(
      "Image",
      class {
        onload: (() => void) | null = null;
        set src(_value: string) {
          // intentionally does not call onload
        }
      },
    );
    const onSubmit = await openModalAndSelectFile(user);
    await user.click(screen.getByRole("button", { name: "profile.avatar.modal.confirm" }));

    expect(createCroppedPreviewUrlMock).not.toHaveBeenCalled();
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ previewUrl: null }));
  });
});
