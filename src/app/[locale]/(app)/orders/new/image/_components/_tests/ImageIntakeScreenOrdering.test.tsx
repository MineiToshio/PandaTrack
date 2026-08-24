import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const translate = (key: string) => key;
    translate.rich = (key: string, tags: Record<string, (chunks: string) => unknown>) =>
      tags.strong ? tags.strong(key) : key;
    return translate;
  },
  useLocale: () => "es",
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
 * One segment per file, tagged with the file's own name through the MIME type. The action turns
 * each segment into a `File` named by its index, so the tag is what makes the ORDER of the upload
 * observable: it is the only property of a segment that survives into the FormData unchanged.
 */
vi.mock("@/lib/images/compressForIntake", () => ({
  prepareSubmissionForIntake: vi.fn().mockImplementation(async (files: File[]) => {
    const results =
    files.map((file) => ({
    segments: [{ blob: new Blob([file.name]), mimeType: `image/png;name=${file.name.replace(".png", "")}` }],
    source: { width: 1179, height: 2556 },
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

vi.mock("@/lib/imageIntake/manualPrefillStash", () => ({ writeManualPrefillStash: vi.fn() }));

const extractOrderFromImagesActionMock = vi.fn();
vi.mock("../../../../_actions/imageIntakeExtractAction", () => ({
  extractOrderFromImagesAction: (formData: FormData) => extractOrderFromImagesActionMock(formData),
}));
vi.mock("../../../../_actions/imageIntakeSaveAction", () => ({ saveOrderFromDraftAction: vi.fn() }));

vi.mock("../IntakeQuotaExhausted", () => ({ default: () => null }));
vi.mock("../IntakeReviewScreen", () => ({ default: () => <div>review</div> }));

/**
 * Stands in for the attach surface with the two things this suite is about: what the list looks
 * like, in order, and the two ways that order changes (a new batch, a manual move).
 */
vi.mock("../IntakeUploadPanel", () => ({
  default: ({
    attachments,
    onFilesAdded,
    onReorder,
    onSubmit,
  }: {
    attachments: { file: File }[];
    onFilesAdded: (files: File[]) => void;
    onReorder: (fromIndex: number, toIndex: number) => void;
    onSubmit: () => void;
  }) => (
    <div>
      <span data-testid="order">{attachments.map((attachment) => attachment.file.name).join(",")}</span>
      <button type="button" onClick={() => onFilesAdded(BATCH_ONE.map(makeFile))}>
        attach-batch-one
      </button>
      <button type="button" onClick={() => onFilesAdded(BATCH_TWO.map(makeFile))}>
        attach-batch-two
      </button>
      <button type="button" onClick={() => onReorder(attachments.length - 1, 0)}>
        move-last-to-front
      </button>
      <button type="button" onClick={() => onSubmit()}>
        extract
      </button>
    </div>
  ),
}));

import ImageIntakeScreen from "../ImageIntakeScreen";

type FileSpec = { name: string; lastModified: number };

/** Handed to the picker out of order on purpose: a file manager gives no ordering guarantee. */
const BATCH_ONE: FileSpec[] = [
  { name: "c.png", lastModified: 3_000 },
  { name: "a.png", lastModified: 1_000 },
  { name: "b.png", lastModified: 2_000 },
];

/** Older than every file of the first batch, so a global sort would pull it to the front. */
const BATCH_TWO: FileSpec[] = [
  { name: "e.png", lastModified: 500 },
  { name: "d.png", lastModified: 100 },
];

function makeFile({ name, lastModified }: FileSpec): File {
  return new File(["x"], name, { type: "image/png", lastModified });
}

const QUOTA = {
  limit: 20,
  usedPhotos: 0,
  remaining: 20,
  periodKey: "2026-07",
  renewalAtIso: "2026-08-01T00:00:00.000Z",
};

function renderScreen() {
  return render(<ImageIntakeScreen storeOptions={[]} quota={QUOTA} baseCurrencyCode="PEN" productTypeKeys={[]} />);
}

function currentOrder(): string {
  return screen.getByTestId("order").textContent ?? "";
}

beforeEach(() => {
  window.localStorage.clear();
  extractOrderFromImagesActionMock.mockReset();
  extractOrderFromImagesActionMock.mockResolvedValue({ ok: false, code: "server-error" });
});

/**
 * The attachments are a sequence the extraction reads as one conversation, so how a new batch joins
 * the list is a correctness question, not a cosmetic one.
 */
describe("ImageIntakeScreen attachment ordering", () => {
  it("sorts a freshly picked batch by capture time, whatever order the picker handed it over in", async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(screen.getByRole("button", { name: "attach-batch-one" }));

    expect(currentOrder()).toBe("a.png,b.png,c.png");
  });

  it("appends a later batch at the end instead of re-sorting the whole list", async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(screen.getByRole("button", { name: "attach-batch-one" }));
    await user.click(screen.getByRole("button", { name: "attach-batch-two" }));

    // The second batch is older by file date than everything already attached. Sorting the whole
    // list would interleave it at the front; the collector's own sequence has to survive an add.
    expect(currentOrder()).toBe("a.png,b.png,c.png,d.png,e.png");
  });

  it("never re-sorts an order the collector set by hand", async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(screen.getByRole("button", { name: "attach-batch-one" }));
    await user.click(screen.getByRole("button", { name: "move-last-to-front" }));
    expect(currentOrder()).toBe("c.png,a.png,b.png");

    await user.click(screen.getByRole("button", { name: "attach-batch-two" }));

    // The manual order is untouched, and the new batch lands behind it. This is the case the file
    // dates cannot decide: someone capturing a chat from the bottom up gets timestamps that lie.
    expect(currentOrder()).toBe("c.png,a.png,b.png,d.png,e.png");
  });

  it("uploads the photos in the order the screen shows them", async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(screen.getByRole("button", { name: "attach-batch-one" }));
    await user.click(screen.getByRole("button", { name: "move-last-to-front" }));
    await user.click(screen.getByRole("button", { name: "extract" }));

    expect(extractOrderFromImagesActionMock).toHaveBeenCalledTimes(1);
    const formData = extractOrderFromImagesActionMock.mock.calls[0][0] as FormData;
    const uploaded = formData
      .getAll("images")
      .filter((entry): entry is File => entry instanceof File)
      .map((file) => file.type);

    // The order the user arranged is the order the model reads: anything else would make the
    // reordering controls a lie.
    expect(uploaded).toEqual(["image/png;name=c", "image/png;name=a", "image/png;name=b"]);
  });
});

/**
 * Preview object URLs outlive a render, so revoking every one of them (and only them) on unmount is
 * an invariant. Reordering must not disturb it: the list of live URLs is a bag to clean up, not a
 * parallel copy of the attachments.
 */
describe("ImageIntakeScreen preview URLs under reordering", () => {
  it("revokes every live preview URL after a reorder, and no others", async () => {
    const created: string[] = [];
    let nextUrlId = 0;
    const createSpy = vi.spyOn(URL, "createObjectURL").mockImplementation(() => {
      const url = `blob:preview-${nextUrlId++}`;
      created.push(url);
      return url;
    });
    const revokeSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    try {
      const user = userEvent.setup();
      const { unmount } = renderScreen();

      await user.click(screen.getByRole("button", { name: "attach-batch-one" }));
      await user.click(screen.getByRole("button", { name: "move-last-to-front" }));
      await user.click(screen.getByRole("button", { name: "attach-batch-two" }));

      expect(created).toHaveLength(5);
      unmount();

      expect(revokeSpy).toHaveBeenCalledTimes(created.length);
      for (const url of created) {
        expect(revokeSpy).toHaveBeenCalledWith(url);
      }
    } finally {
      createSpy.mockRestore();
      revokeSpy.mockRestore();
    }
  });
});
