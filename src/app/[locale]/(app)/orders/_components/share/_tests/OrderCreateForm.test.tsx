import { forwardRef } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ImageIntakeDraft } from "@/lib/imageIntake/draftSchema";
import { writeManualPrefillStash } from "@/lib/imageIntake/manualPrefillStash";
import OrderCreateForm from "../OrderCreateForm";
import type { OrderStoreOption } from "../OrderStoreField";

vi.mock("next-intl", () => {
  const translate = (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key;
  translate.has = () => false;
  translate.rich = (key: string) => key;
  return {
    useTranslations: () => translate,
    useLocale: () => "es",
  };
});

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("posthog-js", () => ({ default: { capture: vi.fn() } }));

// The wizard body (every field) is irrelevant here: this suite only checks the state the manual
// form's own mount effect seeds from the intake hand-off, and that state is already visible,
// unhidden, in the summary sidebar rendered alongside the wizard. Stubbing the wizard chrome out
// entirely also removes the need to mock every field control it would otherwise mount
// (StoreCombobox, the calendar picker, the item grid...), none of which this suite exercises.
vi.mock("@/components/modules/WizardAccordion/WizardAccordion", () => ({
  default: forwardRef(function MockWizardAccordion(_props: unknown, _ref: unknown) {
    return null;
  }),
}));
vi.mock("@/components/modules/WizardAccordion/WizardStep", () => ({
  default: () => null,
}));
vi.mock("../DiscrepancyModal", () => ({ default: () => null }));

const STORES: OrderStoreOption[] = [
  { id: "store-1", name: "Pop Dealer", countryCode: "PE" },
  { id: "store-2", name: "Other Store", countryCode: "PE" },
];

function buildDraft(overrides: Partial<ImageIntakeDraft> = {}): ImageIntakeDraft {
  return {
    store: {
      matchedStoreId: "store-1",
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
        products: [
          { name: "Gojo", unitPrice: 9000, suggestedProductTypeKey: null, referenceUrl: null },
          { name: "Gojo (chase)", unitPrice: 6000, suggestedProductTypeKey: null, referenceUrl: null },
        ],
      },
    ],
    payments: [],
    delivery: null,
    warnings: [],
    ...overrides,
  };
}

const actionMock = vi.fn();

function renderForm() {
  return render(<OrderCreateForm stores={STORES} productTypeKeys={[]} baseCurrencyCode="USD" action={actionMock} />);
}

beforeEach(() => {
  window.sessionStorage.clear();
  pushMock.mockClear();
  actionMock.mockClear();
});

describe("OrderCreateForm manual-prefill hand-off", () => {
  it("opens with today's date, no store, and one blank item when there is no stash (unchanged default behavior)", () => {
    renderForm();

    expect(screen.getByText("summaryStore")).toBeTruthy();
    // No store name anywhere in the summary sidebar: the placeholder dash key is used instead.
    expect(screen.getAllByText("summaryEmpty").length).toBeGreaterThan(0);
    expect(screen.queryByText("Pop Dealer")).toBeNull();
  });

  it("seeds store, currency, date, total, and items from a confirmed intake draft", () => {
    writeManualPrefillStash(buildDraft());

    renderForm();

    expect(screen.getByText("Pop Dealer")).toBeTruthy();
    expect(screen.getByText("PEN")).toBeTruthy();
    // summaryItems is called with the flattened product count from the draft's groups.
    expect(screen.getByText('summaryItems:{"count":2}')).toBeTruthy();
    expect(screen.getByText("150.00 PEN")).toBeTruthy();
  });

  it("clears the stash after reading it: a second mount never resurfaces the same draft", () => {
    writeManualPrefillStash(buildDraft());

    const { unmount } = renderForm();
    expect(screen.getByText("Pop Dealer")).toBeTruthy();
    unmount();

    renderForm();
    expect(screen.queryByText("Pop Dealer")).toBeNull();
    expect(screen.getAllByText("summaryEmpty").length).toBeGreaterThan(0);
  });

  it("ignores a store match that is not in this collector's own store list", () => {
    writeManualPrefillStash(
      buildDraft({
        store: {
          matchedStoreId: "some-other-store",
          name: { value: "Unknown", source: "read" },
          phone: { value: null, source: null },
          candidates: [],
        },
      }),
    );

    renderForm();

    expect(screen.queryByText("Unknown")).toBeNull();
    // The rest of the draft (currency) is still honoured even though the store hand-off was dropped.
    expect(screen.getByText("PEN")).toBeTruthy();
  });

  it("ignores a corrupt stash entry and opens exactly like a normal visit", () => {
    window.sessionStorage.setItem("pandatrack:imageIntake:manualPrefill", "not json at all {");

    renderForm();

    expect(screen.queryByText("Pop Dealer")).toBeNull();
    expect(screen.getAllByText("summaryEmpty").length).toBeGreaterThan(0);
  });

  it("never puts any draft data in the URL", () => {
    writeManualPrefillStash(buildDraft());
    const before = window.location.href;

    renderForm();

    expect(window.location.href).toBe(before);
    expect(window.location.search).toBe("");
  });
});
