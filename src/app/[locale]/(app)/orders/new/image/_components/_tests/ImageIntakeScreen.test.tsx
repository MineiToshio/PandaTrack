import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ImageIntakeDraft } from "@/lib/imageIntake/draftSchema";

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const translate = (key: string) => key;
    translate.rich = (key: string, tags: Record<string, (chunks: string) => unknown>) =>
      tags.strong ? tags.strong(key) : key;
    return translate;
  },
  useLocale: () => "es",
}));

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
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

vi.mock("@/lib/images/compressForIntake", () => ({
  prepareSubmissionForIntake: vi.fn().mockImplementation(async (files: File[]) => {
    const results =
    files.map(() => ({
    segments: [{ blob: new Blob(["x"], { type: "image/png" }), mimeType: "image/png" }],
    // A real iPhone screenshot: the coordinator now judges the prepared photo from what the
    // compression step decoded, so a mock without these dimensions would not exercise the real path.
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

const writeManualPrefillStashMock = vi.fn();
vi.mock("@/lib/imageIntake/manualPrefillStash", () => ({
  writeManualPrefillStash: (draft: ImageIntakeDraft) => writeManualPrefillStashMock(draft),
}));

const extractOrderFromImagesActionMock = vi.fn();
vi.mock("../../../../_actions/imageIntakeExtractAction", () => ({
  extractOrderFromImagesAction: (formData: FormData) => extractOrderFromImagesActionMock(formData),
}));
vi.mock("../../../../_actions/imageIntakeSaveAction", () => ({
  saveOrderFromDraftAction: vi.fn(),
}));

// IntakeUploadPanel and IntakeQuotaExhausted are stubbed to a single trigger each: this suite is
// about ImageIntakeScreen's own wiring (does the confirmed draft reach the stash before the
// manual-form navigation), not about upload UX or quota copy, both already covered by their own
// component suites.
vi.mock("../IntakeUploadPanel", () => ({
  default: ({
    attachments,
    onFilesAdded,
    onRemove,
    onSubmit,
  }: {
    attachments: { id: string }[];
    onFilesAdded: (files: File[]) => void;
    onRemove: (id: string) => void;
    onSubmit: () => void;
  }) => (
    <div>
      <button type="button" onClick={() => onFilesAdded([new File(["x"], "extra.png", { type: "image/png" })])}>
        attach-one
      </button>
      {/* Attach and submit stay separate, as they are in the real panel: a stub doing both in one
          handler submits the attachments as they were before its own attach, an empty batch. */}
      <button type="button" onClick={() => onSubmit()}>
        extract-only
      </button>
      <button type="button" onClick={() => attachments[0] && onRemove(attachments[0].id)}>
        remove-first
      </button>
      <span data-testid="attachment-count">{attachments.length}</span>
    </div>
  ),
}));

vi.mock("../IntakeQuotaExhausted", () => ({
  default: ({ onManualClick }: { onManualClick: () => void }) => (
    <button type="button" onClick={() => onManualClick()}>
      quota-manual
    </button>
  ),
}));

// The real IntakeReviewScreen renders the confirmed (possibly edited) draft as its own local
// state; this stub stands in for "whatever the collector confirmed on screen" without pulling in
// its full document UI, which has its own dedicated test suite.
let reviewScreenReceivedDraft: ImageIntakeDraft | null = null;
let reviewScreenReceivedSpentPhotoCount: number | null = null;
vi.mock("../IntakeReviewScreen", () => ({
  default: ({
    initialDraft,
    onManualClick,
    onAddProductSheet,
    spentPhotoCount,
  }: {
    initialDraft: ImageIntakeDraft;
    onManualClick: (draft: ImageIntakeDraft) => void;
    onAddProductSheet: () => void;
    spentPhotoCount: number;
  }) => {
    reviewScreenReceivedDraft = initialDraft;
    reviewScreenReceivedSpentPhotoCount = spentPhotoCount;
    return (
      <div>
        <button type="button" onClick={() => onManualClick(initialDraft)}>
          review-manual
        </button>
        <button type="button" onClick={() => onAddProductSheet()}>
          review-add-sheet
        </button>
      </div>
    );
  },
}));

import ImageIntakeScreen from "../ImageIntakeScreen";

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

const QUOTA_WITH_ROOM = {
  limit: 20,
  usedPhotos: 1,
  remaining: 19,
  periodKey: "2026-07",
  renewalAtIso: "2026-08-01T00:00:00.000Z",
};
const QUOTA_EXHAUSTED = {
  limit: 20,
  usedPhotos: 20,
  remaining: 0,
  periodKey: "2026-07",
  renewalAtIso: "2026-08-01T00:00:00.000Z",
};

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
  pushMock.mockClear();
  writeManualPrefillStashMock.mockClear();
  extractOrderFromImagesActionMock.mockReset();
  reviewScreenReceivedDraft = null;
  reviewScreenReceivedSpentPhotoCount = null;
});

describe("ImageIntakeScreen manual hand-off", () => {
  it("stashes the confirmed draft and navigates to the plain manual-form path when leaving from review", async () => {
    const draft = buildDraft();
    extractOrderFromImagesActionMock.mockResolvedValue({ ok: true, draft });
    const user = userEvent.setup();

    render(<ImageIntakeScreen storeOptions={[]} quota={QUOTA_WITH_ROOM} baseCurrencyCode="PEN" productTypeKeys={[]} />);

    await user.click(screen.getByRole("button", { name: "attach-one" }));
    await user.click(screen.getByRole("button", { name: "extract-only" }));
    const manualButton = await screen.findByRole("button", { name: "review-manual" });
    expect(reviewScreenReceivedDraft).toEqual(draft);

    await user.click(manualButton);

    expect(writeManualPrefillStashMock).toHaveBeenCalledTimes(1);
    expect(writeManualPrefillStashMock).toHaveBeenCalledWith(draft);
    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith("/es/orders/new");
    // No product name, amount, or any other draft data ever rides along in the destination path.
    expect(pushMock.mock.calls[0][0]).not.toContain("?");
  });

  it("navigates without stashing anything when there was never a draft to carry (quota exhausted before any extraction)", async () => {
    const user = userEvent.setup();
    render(<ImageIntakeScreen storeOptions={[]} quota={QUOTA_EXHAUSTED} baseCurrencyCode="PEN" productTypeKeys={[]} />);

    await user.click(screen.getByRole("button", { name: "quota-manual" }));

    expect(writeManualPrefillStashMock).not.toHaveBeenCalled();
    expect(pushMock).toHaveBeenCalledWith("/es/orders/new");
  });
});

/**
 * The feature's promise is that photos are held in memory only for as long as the flow needs them.
 * Preview object URLs are the one piece that outlives a render, so their revocation on unmount is
 * an invariant, not an optimisation: a leaked blob survives every SPA navigation that follows.
 */
describe("ImageIntakeScreen preview object URLs", () => {
  it("revokes every live preview URL on unmount, including ones attached after a removal", async () => {
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
      const { unmount } = render(
        <ImageIntakeScreen storeOptions={[]} quota={QUOTA_WITH_ROOM} baseCurrencyCode="PEN" productTypeKeys={[]} />,
      );

      await user.click(screen.getByRole("button", { name: "attach-one" }));
      await user.click(screen.getByRole("button", { name: "remove-first" }));
      await user.click(screen.getByRole("button", { name: "attach-one" }));

      expect(created).toHaveLength(2);
      unmount();

      // Both are accounted for: the removed one at removal time, the later one at unmount.
      for (const url of created) {
        expect(revokeSpy).toHaveBeenCalledWith(url);
      }
    } finally {
      createSpy.mockRestore();
      revokeSpy.mockRestore();
    }
  });
});

/**
 * "Add the product page screenshot" is a return trip, not a restart: the batch that was already
 * uploaded has to still be attached, or the collector pays for rebuilding it as well as for the
 * second read.
 */
describe("ImageIntakeScreen product sheet round trip", () => {
  it("reports the photos the read really spent, counted in uploaded segments", async () => {
    extractOrderFromImagesActionMock.mockResolvedValue({ ok: true, draft: buildDraft() });
    const user = userEvent.setup();

    render(<ImageIntakeScreen storeOptions={[]} quota={QUOTA_WITH_ROOM} baseCurrencyCode="PEN" productTypeKeys={[]} />);

    await user.click(screen.getByRole("button", { name: "attach-one" }));
    await user.click(screen.getByRole("button", { name: "extract-only" }));
    await screen.findByRole("button", { name: "review-add-sheet" });

    // The compression stub yields one segment per file, so one attached photo spent one photo.
    expect(reviewScreenReceivedSpentPhotoCount).toBe(1);
  });

  it("returns to the attach surface with the photos of the submission still attached", async () => {
    extractOrderFromImagesActionMock.mockResolvedValue({ ok: true, draft: buildDraft() });
    const user = userEvent.setup();

    render(<ImageIntakeScreen storeOptions={[]} quota={QUOTA_WITH_ROOM} baseCurrencyCode="PEN" productTypeKeys={[]} />);

    await user.click(screen.getByRole("button", { name: "attach-one" }));
    await user.click(screen.getByRole("button", { name: "extract-only" }));
    await user.click(await screen.findByRole("button", { name: "review-add-sheet" }));

    expect(screen.getByTestId("attachment-count").textContent).toBe("1");
    expect(screen.queryByRole("button", { name: "review-add-sheet" })).toBeNull();
  });

  it("extracts again over the whole batch once the missing screenshot is added", async () => {
    extractOrderFromImagesActionMock.mockResolvedValue({ ok: true, draft: buildDraft() });
    const user = userEvent.setup();

    render(<ImageIntakeScreen storeOptions={[]} quota={QUOTA_WITH_ROOM} baseCurrencyCode="PEN" productTypeKeys={[]} />);

    await user.click(screen.getByRole("button", { name: "attach-one" }));
    await user.click(screen.getByRole("button", { name: "extract-only" }));
    await user.click(await screen.findByRole("button", { name: "review-add-sheet" }));
    await user.click(screen.getByRole("button", { name: "attach-one" }));
    await user.click(screen.getByRole("button", { name: "extract-only" }));

    await screen.findByRole("button", { name: "review-add-sheet" });
    // Two photos went up on the second pass: the original plus the product page screenshot.
    expect(reviewScreenReceivedSpentPhotoCount).toBe(2);
  });
});
