import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Cover for the refusal a collector actually meets when a photo cannot be read, exercised against
 * the real `IntakeUploadPanel` so the CTA's own state is part of the assertion.
 *
 * The failure this suite exists for: a wide, short crop (a single chat line, a receipt strip) is
 * plentiful in pixels but is normalised to 1080px wide before it is read, which drops its height
 * under the readable minimum. That was reported as "one of the photos is too small or too large",
 * with no photo named and no figure quoted, to someone looking at a 3000px wide screenshot.
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

vi.mock("@/contexts/ToastContext", () => ({
  useToast: () => ({ addToast: vi.fn(), removeToast: vi.fn() }),
  // The progression feedback provider this screen now reports its credit to reads the shared
  // auto-dismiss window from here, so the mock has to carry it or the module fails to import.
  DEFAULT_DURATION_MS: 4000,
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

/**
 * What the browser reports for each preview URL. jsdom never fires `load` on an `<img>`, so the one
 * genuinely environment-bound step is stubbed; everything it feeds (the projection through the
 * preparation step, the verdict, the copy, the CTA) is the real code.
 */
const dimensionsByUrl = new Map<string, { width: number; height: number } | null>();
vi.mock("@/lib/images/readImageDimensions", () => ({
  readImageDimensionsFromUrl: (url: string) => Promise.resolve(dimensionsByUrl.get(url) ?? null),
}));

/** Source dimensions the preparation step reports back, per attached file name. */
const sourceDimensionsByFileName = new Map<string, { width: number; height: number }>();
/** Byte size of the PREPARED segment, per attached file name. Defaults to a realistic small one. */
const preparedBytesByFileName = new Map<string, number>();
vi.mock("@/lib/images/compressForIntake", () => ({
  prepareSubmissionForIntake: vi.fn().mockImplementation(async (files: File[]) => {
    const results =
    files.map((file) => ({
    segments: [
    {
    blob: new Blob([new Uint8Array(preparedBytesByFileName.get(file.name) ?? 180 * 1024)], {
    type: "image/webp",
    }),
    mimeType: "image/webp",
    },
    ],
    source: sourceDimensionsByFileName.get(file.name) ?? { width: 1179, height: 2556 },
    }));
    const totalBytes = results.flatMap((r) => r.segments).reduce((sum, s) => sum + s.blob.size, 0);
    return {
      results,
      totalBytes,
      webpQuality: 0.85,
      usedFallbackQuality: false,
      // Derived, never hardcoded: a suite that stubs an oversized prepared segment needs
      // the stub to agree with it rather than to claim the submission fits.
      fits: totalBytes <= 3.5 * 1024 * 1024,
    };
  }),
}));

const extractOrderFromImagesActionMock = vi.fn();
vi.mock("../../../../_actions/imageIntakeExtractAction", () => ({
  extractOrderFromImagesAction: (formData: FormData) => extractOrderFromImagesActionMock(formData),
}));
vi.mock("../../../../_actions/imageIntakeSaveAction", () => ({
  saveOrderFromDraftAction: vi.fn(),
}));

import { MAX_IMAGE_FILE_BYTES } from "@/lib/imageIntake/constants";
import { IMAGE_INTAKE_FILES_FIELD } from "../../../../_actions/imageIntakeContract";
import ImageIntakeScreen from "../ImageIntakeScreen";

const QUOTA_WITH_ROOM = {
  limit: 20,
  usedPhotos: 1,
  remaining: 19,
  periodKey: "2026-07",
  renewalAtIso: "2026-08-01T00:00:00.000Z",
};

function screenshot(name: string): File {
  return new File(["x"], name, { type: "image/png" });
}

/** A source photo of a real weight, which the fixtures above otherwise never have. */
function screenshotOfBytes(name: string, byteSize: number): File {
  return new File([new Uint8Array(byteSize)], name, { type: "image/png" });
}

function imageTransfer(...files: File[]): Record<string, unknown> {
  return {
    types: ["Files"],
    items: files.map((file) => ({ kind: "file", type: file.type, getAsFile: () => file })),
    files,
  };
}

function dropTarget(): HTMLElement {
  return screen.getByText("upload.dropzoneHint").closest("button") as HTMLElement;
}

function submitButton(): HTMLButtonElement {
  return screen.getByRole("button", { name: "upload.submit" }) as HTMLButtonElement;
}

beforeEach(() => {
  window.localStorage.clear();
  dimensionsByUrl.clear();
  sourceDimensionsByFileName.clear();
  preparedBytesByFileName.clear();
  extractOrderFromImagesActionMock.mockReset();
  extractOrderFromImagesActionMock.mockResolvedValue({ ok: false, code: "server-error" });
  let nextUrlId = 0;
  vi.spyOn(URL, "createObjectURL").mockImplementation(() => `blob:preview-${nextUrlId++}`);
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ImageIntakeScreen unreadable photos", () => {
  it("names the wide crop as soon as it is attached, with its size and the height it needs", async () => {
    // A 10:1 chat strip: nothing about it is small, and normalising it to 1080px wide leaves 108px
    // of height, under the 200px minimum the reader needs.
    dimensionsByUrl.set("blob:preview-0", { width: 1179, height: 2556 });
    dimensionsByUrl.set("blob:preview-1", { width: 3000, height: 300 });

    render(<ImageIntakeScreen storeOptions={[]} quota={QUOTA_WITH_ROOM} baseCurrencyCode="PEN" productTypeKeys={[]} />);

    fireEvent.drop(dropTarget(), {
      dataTransfer: imageTransfer(screenshot("chat.png"), screenshot("recorte.png")),
    });

    const line = await screen.findByText(/errors\.photoTooWide/);
    // The photo it names, the size it really is, and the height that would work: 200 x 3000 / 1080.
    expect(line.textContent).toContain("errors.photoLabelNamed");
    expect(line.textContent).toContain('\\"position\\":2');
    expect(line.textContent).toContain("recorte.png");
    expect(line.textContent).toContain('"width":3000');
    expect(line.textContent).toContain('"height":300');
    expect(line.textContent).toContain('"minHeight":556');

    // Told before anything is spent, which is the whole point of measuring at attach time.
    expect(submitButton()).toBeDisabled();
    expect(extractOrderFromImagesActionMock).not.toHaveBeenCalled();
  });

  it("names a genuinely small photo as small, not as one of two possibilities", async () => {
    dimensionsByUrl.set("blob:preview-0", { width: 150, height: 150 });

    render(<ImageIntakeScreen storeOptions={[]} quota={QUOTA_WITH_ROOM} baseCurrencyCode="PEN" productTypeKeys={[]} />);

    fireEvent.drop(dropTarget(), { dataTransfer: imageTransfer(screenshot("miniatura.png")) });

    const line = await screen.findByText(/errors\.photoTooSmall/);
    expect(line.textContent).toContain("miniatura.png");
    expect(line.textContent).toContain('"width":150');
    expect(line.textContent).toContain('"minDimension":200');
    expect(screen.queryByText(/errors\.photoTooWide/)).toBeNull();
  });

  it("lifts the refusal when the offending photo is removed", async () => {
    dimensionsByUrl.set("blob:preview-0", { width: 1179, height: 2556 });
    dimensionsByUrl.set("blob:preview-1", { width: 3000, height: 300 });
    const user = userEvent.setup();

    render(<ImageIntakeScreen storeOptions={[]} quota={QUOTA_WITH_ROOM} baseCurrencyCode="PEN" productTypeKeys={[]} />);

    fireEvent.drop(dropTarget(), {
      dataTransfer: imageTransfer(screenshot("chat.png"), screenshot("recorte.png")),
    });
    await screen.findByText(/errors\.photoTooWide/);

    await user.click(screen.getByRole("button", { name: 'upload.removeOne:{"name":"recorte.png"}' }));

    await waitFor(() => expect(screen.queryByText(/errors\.photoTooWide/)).toBeNull());
    expect(submitButton()).not.toBeDisabled();
  });

  it("still stops the submission, and still names the photo, when the photo was never measured", async () => {
    // The share pickup submits the instant the files land, so the attach-time pass can have no
    // verdict yet. The preparation step decodes the same photo anyway, and that is what decides.
    sourceDimensionsByFileName.set("recorte.png", { width: 3000, height: 300 });
    const user = userEvent.setup();

    render(<ImageIntakeScreen storeOptions={[]} quota={QUOTA_WITH_ROOM} baseCurrencyCode="PEN" productTypeKeys={[]} />);

    fireEvent.drop(dropTarget(), { dataTransfer: imageTransfer(screenshot("recorte.png")) });
    await screen.findByTestId("thumb");
    await user.click(submitButton());

    const line = await screen.findByText(/errors\.photoTooWide/);
    expect(line.textContent).toContain("recorte.png");
    expect(extractOrderFromImagesActionMock).not.toHaveBeenCalled();
  });

  it("lets an ordinary batch of screenshots through untouched", async () => {
    dimensionsByUrl.set("blob:preview-0", { width: 1179, height: 2556 });
    dimensionsByUrl.set("blob:preview-1", { width: 1440, height: 3120 });
    const user = userEvent.setup();

    render(<ImageIntakeScreen storeOptions={[]} quota={QUOTA_WITH_ROOM} baseCurrencyCode="PEN" productTypeKeys={[]} />);

    fireEvent.drop(dropTarget(), {
      dataTransfer: imageTransfer(screenshot("chat-1.png"), screenshot("chat-2.png")),
    });
    await waitFor(() => expect(screen.getAllByTestId("thumb")).toHaveLength(2));
    await user.click(submitButton());

    await waitFor(() => expect(extractOrderFromImagesActionMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/errors\.photoToo/)).toBeNull();
  });

  it("reads a full-resolution screenshot heavier than the per-file ceiling, and uploads it prepared", async () => {
    // The regression this covers: the 2.7 MB PNG a phone hands over was refused for its own weight,
    // before the preparation step that turns it into a couple of hundred kilobytes had run. A source
    // photo's byte size is neither something its owner can change nor what actually gets uploaded,
    // so it is not a reason to refuse anything.
    dimensionsByUrl.set("blob:preview-0", { width: 1179, height: 2556 });
    const user = userEvent.setup();

    render(<ImageIntakeScreen storeOptions={[]} quota={QUOTA_WITH_ROOM} baseCurrencyCode="PEN" productTypeKeys={[]} />);

    fireEvent.drop(dropTarget(), {
      dataTransfer: imageTransfer(screenshotOfBytes("captura.png", Math.round(2.7 * 1024 * 1024))),
    });
    await screen.findByTestId("thumb");
    await user.click(submitButton());

    await waitFor(() => expect(extractOrderFromImagesActionMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/errors\.photoTooHeavy|errors\.fileTooLarge/)).toBeNull();

    // What left the device is the prepared segment, not the source: the ceiling still holds, it is
    // just applied to the only bytes it was ever about.
    const formData = extractOrderFromImagesActionMock.mock.calls[0][0] as FormData;
    const uploaded = formData.getAll(IMAGE_INTAKE_FILES_FIELD) as File[];
    expect(uploaded).toHaveLength(1);
    expect(uploaded[0].size).toBeLessThan(MAX_IMAGE_FILE_BYTES);
  });

  it("tells the collector how many photos fit when the prepared batch is over the budget", async () => {
    // The batch does not fit even after the fit pass. A refusal that only restates the rule sends
    // the collector into a remove-one-and-retry loop; the count turns it into one decision.
    const user = userEvent.setup();
    const names = ["p1.png", "p2.png", "p3.png", "p4.png", "p5.png"];
    names.forEach((name, index) => {
      dimensionsByUrl.set(`blob:preview-${index}`, { width: 1179, height: 2556 });
      preparedBytesByFileName.set(name, 900 * 1024);
    });

    render(<ImageIntakeScreen storeOptions={[]} quota={QUOTA_WITH_ROOM} baseCurrencyCode="PEN" productTypeKeys={[]} />);

    fireEvent.drop(dropTarget(), { dataTransfer: imageTransfer(...names.map(screenshot)) });
    await waitFor(() => expect(screen.getAllByTestId("thumb")).toHaveLength(5));
    await user.click(submitButton());

    // 3.5 MB budget over 900 KB per photo: the first three go through.
    const line = await screen.findByText(/errors\.submissionTooLargeWithFit/);
    expect(line.textContent).toContain('"count":3');
    expect(extractOrderFromImagesActionMock).not.toHaveBeenCalled();
  });

  it("still refuses a photo whose PREPARED segment exceeds the per-file ceiling, naming that photo", async () => {
    // The ceiling did not move, it changed stage. A source that survives preparation still over the
    // limit is refused, and the sentence names the photo it came from.
    dimensionsByUrl.set("blob:preview-0", { width: 1179, height: 2556 });
    preparedBytesByFileName.set("densa.png", MAX_IMAGE_FILE_BYTES + 1);
    const user = userEvent.setup();

    render(<ImageIntakeScreen storeOptions={[]} quota={QUOTA_WITH_ROOM} baseCurrencyCode="PEN" productTypeKeys={[]} />);

    fireEvent.drop(dropTarget(), { dataTransfer: imageTransfer(screenshot("densa.png")) });
    await screen.findByTestId("thumb");
    await user.click(submitButton());

    const line = await screen.findByText(/errors\.photoTooHeavy/);
    expect(line.textContent).toContain("densa.png");
    expect(extractOrderFromImagesActionMock).not.toHaveBeenCalled();
  });
});
