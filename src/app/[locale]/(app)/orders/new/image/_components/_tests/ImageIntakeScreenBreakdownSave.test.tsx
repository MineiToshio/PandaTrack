import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ImageIntakeDraft } from "@/lib/imageIntake/draftSchema";
import type { IntakeBreakdownPayload } from "@/lib/imageIntake/intakeBreakdownContract";

/**
 * What the coordinator does with the breakdown: it forwards it to the save action, and it tells the
 * collector apart from a plain dropped payment when a row with typed lines does not make it.
 *
 * The two sentences are not interchangeable. The generic one says "add it to the order by hand",
 * which for a plain row means two fields and for a broken-down one means retyping up to N lines
 * against an order that already exists. Reusing one toast for both is the regression this file
 * exists to catch, so the toast KEY is what is asserted rather than the fact that a toast appeared.
 */
vi.mock("next-intl", () => ({
  useTranslations: () => {
    const translate = (key: string, values?: Record<string, unknown>) =>
      values ? `${key}:${JSON.stringify(values)}` : key;
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

const addToastMock = vi.fn();
vi.mock("@/contexts/ToastContext", () => ({
  useToast: () => ({ addToast: addToastMock, removeToast: vi.fn() }),
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

const extractOrderFromImagesActionMock = vi.fn();
vi.mock("../../../../_actions/imageIntakeExtractAction", () => ({
  extractOrderFromImagesAction: (formData: FormData) => extractOrderFromImagesActionMock(formData),
}));

const saveOrderFromDraftActionMock = vi.fn();
vi.mock("../../../../_actions/imageIntakeSaveAction", () => ({
  saveOrderFromDraftAction: (...args: unknown[]) => saveOrderFromDraftActionMock(...args),
}));

// Attach and submit are two separate acts, as they are in the real panel. A stub doing both in one
// handler submits the attachments as they were before its own attach, which is an empty batch.
vi.mock("../IntakeUploadPanel", () => ({
  default: ({ onFilesAdded, onSubmit }: { onFilesAdded: (files: File[]) => void; onSubmit: () => void }) => (
    <div>
      <button
        type="button"
        onClick={() => onFilesAdded([new File(["x"], "receipt.png", { type: "image/png" })])}
      >
        attach-one
      </button>
      <button type="button" onClick={() => onSubmit()}>
        extract-only
      </button>
    </div>
  ),
}));

vi.mock("../IntakeQuotaExhausted", () => ({ default: () => null }));

/** The breakdown the stubbed review screen declares, standing in for a panel the collector filled. */
const DECLARED_BREAKDOWN: IntakeBreakdownPayload = [{ paymentIndex: 1, lines: [{ position: 1, amountMinor: 4000 }] }];

// The review screen has its own suite; here it is only the thing that hands a confirmed draft, a
// rate and a breakdown to the coordinator.
vi.mock("../IntakeReviewScreen", () => ({
  default: ({
    initialDraft,
    onSave,
  }: {
    initialDraft: ImageIntakeDraft;
    onSave: (draft: ImageIntakeDraft, rate: number | null, breakdown: IntakeBreakdownPayload | undefined) => void;
  }) => (
    <div>
      <button type="button" onClick={() => onSave(initialDraft, null, DECLARED_BREAKDOWN)}>
        save-with-breakdown
      </button>
      <button type="button" onClick={() => onSave(initialDraft, null, undefined)}>
        save-plain
      </button>
    </div>
  ),
}));

import ImageIntakeScreen from "../ImageIntakeScreen";

const ORDER_ID = "clo1234567890abcdefghijkl";

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

const QUOTA = {
  limit: 20,
  usedPhotos: 1,
  remaining: 19,
  periodKey: "2026-07",
  renewalAtIso: "2026-08-01T00:00:00.000Z",
};

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
  vi.clearAllMocks();
  extractOrderFromImagesActionMock.mockResolvedValue({ ok: true, draft: buildDraft() });
});

/** Attaches, extracts, and presses the review screen's save button of the given name. */
async function saveThrough(buttonName: string) {
  const user = userEvent.setup();
  render(<ImageIntakeScreen storeOptions={[]} quota={QUOTA} baseCurrencyCode="PEN" productTypeKeys={[]} />);
  await user.click(screen.getByRole("button", { name: "attach-one" }));
  await user.click(screen.getByRole("button", { name: "extract-only" }));
  await user.click(await screen.findByRole("button", { name: buttonName }));
}

/** Every toast message the screen raised, in order. */
function toastMessages(): string[] {
  return addToastMock.mock.calls.map((call) => String(call[0]));
}

describe("ImageIntakeScreen · the breakdown reaches the action (T13, client half)", () => {
  it("forwards the declared lines as the action's fourth argument", async () => {
    saveOrderFromDraftActionMock.mockResolvedValue({
      ok: true,
      orderId: ORDER_ID,
      paymentsRecorded: 2,
      paymentsSkipped: 0,
      skippedBreakdownIndexes: [],
      breakdownDropped: 0,
    });

    await saveThrough("save-with-breakdown");

    expect(saveOrderFromDraftActionMock).toHaveBeenCalledTimes(1);
    expect(saveOrderFromDraftActionMock.mock.calls[0][3]).toEqual(DECLARED_BREAKDOWN);
  });

  it("sends nothing when the collector split nothing", async () => {
    saveOrderFromDraftActionMock.mockResolvedValue({
      ok: true,
      orderId: ORDER_ID,
      paymentsRecorded: 1,
      paymentsSkipped: 0,
      skippedBreakdownIndexes: [],
      breakdownDropped: 0,
    });

    await saveThrough("save-plain");

    expect(saveOrderFromDraftActionMock.mock.calls[0][3]).toBeUndefined();
  });
});

describe("ImageIntakeScreen · a lost breakdown gets its own sentence (T13, toast half)", () => {
  it("says the breakdown one, and not the generic one, when the dropped row carried lines", async () => {
    saveOrderFromDraftActionMock.mockResolvedValue({
      ok: true,
      orderId: ORDER_ID,
      paymentsRecorded: 1,
      paymentsSkipped: 1,
      skippedBreakdownIndexes: [1],
      breakdownDropped: 0,
    });

    await saveThrough("save-with-breakdown");

    expect(toastMessages()).toEqual(['save.breakdownSkipped:{"count":1}']);
    expect(pushMock).toHaveBeenCalledWith(`/es/orders/${ORDER_ID}`);
  });

  it("says the generic one when the dropped row carried none", async () => {
    saveOrderFromDraftActionMock.mockResolvedValue({
      ok: true,
      orderId: ORDER_ID,
      paymentsRecorded: 1,
      paymentsSkipped: 1,
      skippedBreakdownIndexes: [],
      breakdownDropped: 0,
    });

    await saveThrough("save-plain");

    expect(toastMessages()).toEqual(['save.paymentsSkipped:{"count":1}']);
  });

  it("says both, counted apart, when one row of each was dropped", async () => {
    saveOrderFromDraftActionMock.mockResolvedValue({
      ok: true,
      orderId: ORDER_ID,
      paymentsRecorded: 0,
      paymentsSkipped: 2,
      skippedBreakdownIndexes: [1],
      breakdownDropped: 0,
    });

    await saveThrough("save-with-breakdown");

    expect(toastMessages()).toEqual(['save.breakdownSkipped:{"count":1}', 'save.paymentsSkipped:{"count":1}']);
  });

  /**
   * The retry branch (T6's client half). It reports named breakdowns against a skip count of ZERO,
   * because nothing was written on this attempt and which rows survived the first one is unknowable.
   * A naive `paymentsSkipped - breakdownCount` goes negative there and, unclamped, the generic
   * sentence either vanishes or fires on a subtraction nobody meant.
   */
  it("still speaks up on the mute-retry branch, and raises only the breakdown sentence", async () => {
    saveOrderFromDraftActionMock.mockResolvedValue({
      ok: true,
      orderId: ORDER_ID,
      paymentsRecorded: 0,
      paymentsSkipped: 0,
      skippedBreakdownIndexes: [1],
      breakdownDropped: 0,
    });

    await saveThrough("save-with-breakdown");

    expect(toastMessages()).toEqual(['save.breakdownSkipped:{"count":1}']);
  });
});
