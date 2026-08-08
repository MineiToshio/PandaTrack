import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ImageIntakeDraft } from "@/lib/imageIntake/draftSchema";

/**
 * Integration cover for the two entry doors added to the attach surface, exercised against the real
 * `IntakeUploadPanel` instead of the stub the main coordinator suite uses.
 *
 * What only this level can prove: a drop or a paste travels the same route as the file picker (the
 * coordinator's `handleFilesAdded`, which owns preview creation), an unsupported drop reaches the
 * shared error banner, and the paste door closes as soon as the flow leaves the upload phase, since
 * the phase is what mounts the surface that listens.
 */

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => {
    const short = (key: string) => `${namespace.split(".").pop()}.${key}`;
    const translate = (key: string, values?: Record<string, unknown>) =>
      values ? `${short(key)}:${JSON.stringify(values)}` : short(key);
    translate.rich = (key: string, tags: Record<string, (chunks: string) => unknown>) =>
      tags.strong ? tags.strong(short(key)) : short(key);
    return translate;
  },
  useLocale: () => "es",
}));

vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span data-testid="thumb" aria-label={alt} />,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// The screen raises a toast when the save skips a payment. These suites render it outside the app
// shell that owns the provider, so the hook is stubbed rather than the provider mounted: none of
// them exercises the toast itself.
vi.mock("@/contexts/ToastContext", () => ({
  useToast: () => ({ addToast: vi.fn(), removeToast: vi.fn() }),
}));

vi.mock("posthog-js", () => ({ default: { capture: vi.fn() } }));

vi.mock("@/lib/auth/auth-client", () => ({
  authClient: { getSession: vi.fn().mockResolvedValue({ data: null }) },
}));

vi.mock("@/lib/pwa/shareStash", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/pwa/shareStash")>();
  return {
    ...actual,
    readAndClearShareStash: vi.fn().mockResolvedValue({ outcome: "empty" }),
    sweepExpiredShareStash: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("@/lib/images/compressForIntake", () => ({
  compressForIntake: vi.fn().mockResolvedValue({
    segments: [{ blob: new Blob(["x"], { type: "image/png" }), mimeType: "image/png" }],
  }),
}));

vi.mock("@/lib/imageIntake/clientPrecheck", () => ({
  precheckIntakeSubmission: () => ({ ok: true as const }),
}));

vi.mock("@/lib/imageIntake/manualPrefillStash", () => ({
  writeManualPrefillStash: vi.fn(),
}));

const extractOrderFromImagesActionMock = vi.fn();
vi.mock("../../../../_actions/imageIntakeExtractAction", () => ({
  extractOrderFromImagesAction: (formData: FormData) => extractOrderFromImagesActionMock(formData),
}));
vi.mock("../../../../_actions/imageIntakeSaveAction", () => ({
  saveOrderFromDraftAction: vi.fn(),
}));

// Only the review destination is stubbed: this suite needs to know when the flow left the upload
// phase, not what the review document looks like.
vi.mock("../IntakeReviewScreen", () => ({
  default: () => <p>review-reached</p>,
}));

import ImageIntakeScreen from "../ImageIntakeScreen";

const QUOTA_WITH_ROOM = {
  limit: 20,
  usedPhotos: 1,
  remaining: 19,
  periodKey: "2026-07",
  renewalAtIso: "2026-08-01T00:00:00.000Z",
};

function buildDraft(): ImageIntakeDraft {
  return {
    store: {
      matchedStoreId: "clxxxxxxxxxxxxxxxxxxxxxx0",
      name: { value: "Pop Dealer", source: "read" },
      phone: { value: null, source: null },
      candidates: [],
    },
    currency: { value: "PEN", source: "read" },
    orderDate: { value: "2026-07-20", source: "read" },
    totalCost: { value: 15000, source: "read" },
    groups: [
      {
        sourcePhrase: "el pack de Gojo",
        reason: "split",
        doubtful: false,
        priceSplit: "explicit-unit",
        products: [{ name: "Gojo", unitPrice: 15000, suggestedProductTypeKey: null, referenceUrl: null }],
      },
    ],
    payments: [],
    delivery: null,
    warnings: [],
  };
}

function imageTransfer(...files: File[]): Record<string, unknown> {
  return {
    types: ["Files"],
    items: files.map((file) => ({ kind: "file", type: file.type, getAsFile: () => file })),
    files,
  };
}

function screenshot(name = "screenshot.png", type = "image/png"): File {
  return new File(["x"], name, { type });
}

/**
 * The dashed picker, used here as the place a photo is released. Firing on it rather than on the
 * surface that carries the handlers is deliberate: it is where a real cursor lands, and it only
 * works if the drop bubbles up to the surface, which is the wiring under test.
 */
function dropTarget(): HTMLElement {
  return screen.getByText("upload.dropzoneHint").closest("button") as HTMLElement;
}

let createObjectUrlSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.localStorage.clear();
  extractOrderFromImagesActionMock.mockReset();
  let nextUrlId = 0;
  createObjectUrlSpy = vi.spyOn(URL, "createObjectURL").mockImplementation(() => `blob:preview-${nextUrlId++}`);
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ImageIntakeScreen clipboard and drop doors", () => {
  it("attaches a pasted screenshot through the same path as the file picker", () => {
    render(<ImageIntakeScreen storeOptions={[]} quota={QUOTA_WITH_ROOM} baseCurrencyCode="PEN" productTypeKeys={[]} />);

    fireEvent.paste(document.body, { clipboardData: imageTransfer(screenshot()) });

    expect(screen.getByText('upload.attachedTitle:{"count":1}')).toBeInTheDocument();
    // A preview object URL is the observable proof the coordinator's own handler ran, not a
    // shortcut that skipped it.
    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
  });

  it("attaches dropped screenshots and keeps counting them alongside pasted ones", () => {
    render(<ImageIntakeScreen storeOptions={[]} quota={QUOTA_WITH_ROOM} baseCurrencyCode="PEN" productTypeKeys={[]} />);

    fireEvent.paste(document.body, { clipboardData: imageTransfer(screenshot("one.png")) });
    fireEvent.drop(dropTarget(), {
      dataTransfer: imageTransfer(screenshot("two.png"), screenshot("three.webp", "image/webp")),
    });

    expect(screen.getByText('upload.attachedTitle:{"count":3}')).toBeInTheDocument();
  });

  it("shows the shared format error when a drop carries something the picker would never offer", () => {
    render(<ImageIntakeScreen storeOptions={[]} quota={QUOTA_WITH_ROOM} baseCurrencyCode="PEN" productTypeKeys={[]} />);

    fireEvent.drop(dropTarget(), {
      dataTransfer: imageTransfer(new File(["x"], "receipt.pdf", { type: "application/pdf" })),
    });

    // The coordinator reads the flat `imageIntake` namespace, so its keys keep the `errors.` prefix.
    expect(screen.getByText("imageIntake.errors.unsupportedFormat")).toBeInTheDocument();
    expect(screen.queryByText(/upload\.attachedTitle/)).not.toBeInTheDocument();
  });

  it("stops listening for pastes once the flow leaves the upload phase", async () => {
    extractOrderFromImagesActionMock.mockResolvedValue({ ok: true, draft: buildDraft() });
    const user = userEvent.setup();
    render(<ImageIntakeScreen storeOptions={[]} quota={QUOTA_WITH_ROOM} baseCurrencyCode="PEN" productTypeKeys={[]} />);

    fireEvent.paste(document.body, { clipboardData: imageTransfer(screenshot()) });
    await user.click(screen.getByRole("button", { name: "upload.submit" }));
    expect(await screen.findByText("review-reached")).toBeInTheDocument();

    const callsBefore = createObjectUrlSpy.mock.calls.length;
    const notCancelled = fireEvent.paste(document.body, { clipboardData: imageTransfer(screenshot("late.png")) });

    expect(createObjectUrlSpy.mock.calls).toHaveLength(callsBefore);
    expect(notCancelled).toBe(true);
  });
});
