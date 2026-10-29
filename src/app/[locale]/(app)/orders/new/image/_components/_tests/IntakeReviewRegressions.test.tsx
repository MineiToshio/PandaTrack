import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode, KeyboardEvent } from "react";
import type { ImageIntakeDraft } from "@/lib/imageIntake/draftSchema";
import IntakeReviewScreen from "../IntakeReviewScreen";

const viewport = vi.hoisted(() => ({ mobile: false, categoryChoice: null as string | null }));
vi.mock("@/hooks/useIsMobile", () => ({ useIsMobile: () => viewport.mobile }));
vi.mock("next-intl", () => {
  const translate = (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key;
  translate.has = () => true;
  translate.rich = (key: string, tags: Record<string, (text: string) => unknown>) => (tags.link ? tags.link(key) : key);
  return { useTranslations: () => translate, useLocale: () => "en" };
});
vi.mock("posthog-js", () => ({ default: { capture: vi.fn() } }));
vi.mock("@/lib/fx/exchangeRates", () => ({ fetchTodayRate: vi.fn(async () => ({ ok: false })) }));
vi.mock("@/components/modules/Sheet/Sheet", () => ({
  default: ({
    open,
    title,
    children,
    footer,
  }: {
    open: boolean;
    title: string;
    children: ReactNode;
    footer: ReactNode;
  }) =>
    open ? (
      <div role="dialog" aria-label={title}>
        {children}
        {footer}
      </div>
    ) : null,
}));
vi.mock("../../../../_components/share/ItemTypePicker", () => ({
  default: ({
    value,
    onChange,
    onKeyDown,
    triggerId,
  }: {
    value: string;
    onChange: (value: string) => void;
    onKeyDown: (event: KeyboardEvent) => void;
    triggerId: string;
  }) => (
    <button
      type="button"
      id={triggerId}
      onClick={() => onChange(viewport.categoryChoice ?? (value === "manga" ? "figures" : "manga"))}
      onKeyDown={onKeyDown}
      aria-label={`Category ${triggerId}`}
    >
      {value || "Uncategorized"}
    </button>
  ),
}));
vi.mock("react-day-picker", () => ({
  DayPicker: ({ onSelect }: { onSelect: (date: Date) => void }) => (
    <button type="button" onClick={() => onSelect(new Date(2026, 7, 1))}>
      Pick August 1
    </button>
  ),
}));

function field<T>(value: T | null, source: "read" | "assumed" | null = value === null ? null : "read") {
  return { value, source };
}
function draft(): ImageIntakeDraft {
  return {
    store: { matchedStoreId: "store-1", name: field("Store"), phone: field(null), candidates: [] },
    currency: field("PEN"),
    orderDate: field("2026-07-20"),
    totalCost: field(5000),
    groups: [
      {
        sourcePhrase: "Manga 1",
        reason: "split",
        doubtful: false,
        priceSplit: "explicit-unit",
        products: [{ name: "Manga 1", unitPrice: 5000, suggestedProductTypeKey: null, referenceUrl: null }],
      },
    ],
    payments: [],
    delivery: null,
    warnings: [],
  };
}
function mount(value = draft()) {
  const onSave = vi.fn();
  render(
    <IntakeReviewScreen
      initialDraft={value}
      baseCurrencyCode="PEN"
      storeOptions={[{ id: "store-1", name: "Store" }]}
      productTypeKeys={["figures", "manga"]}
      isSaving={false}
      onSave={onSave}
      onManualClick={vi.fn()}
      spentPhotoCount={1}
      remainingPhotos={null}
      onAddProductSheet={vi.fn()}
    />,
  );
  return onSave;
}
function addProduct(name: string) {
  fireEvent.click(screen.getByRole("button", { name: "create.addProductButton" }));
  const form = screen.getByRole("dialog", { name: "title" });
  fireEvent.change(within(form).getByLabelText("nameLabel"), { target: { value: name } });
  fireEvent.click(within(form).getByRole("button", { name: "add" }));
}
function save() {
  fireEvent.click(screen.getAllByRole("button", { name: "create.submit" })[0]);
}
function markerFor(controlId: string, label: string) {
  return within(document.querySelector(`label[for="${controlId}"]`) as HTMLElement).getByText(label);
}
function expectWarning(controlId: string, label: string) {
  expect(markerFor(controlId, label).getAttribute("style")).toContain("--warning");
}
function expectNeutral(controlId: string, label: string) {
  expect(markerFor(controlId, label).getAttribute("style")).not.toContain("--warning");
}

afterEach(() => {
  viewport.mobile = false;
  viewport.categoryChoice = null;
  vi.useRealTimers();
});

describe("review polish: totals and payment status", () => {
  it("confirms matching totals and offers reconciliation only inside the mismatch warning", () => {
    mount();
    expect(screen.queryByRole("button", { name: "totals.useCalculated" })).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("totals.matches");
    fireEvent.change(screen.getByLabelText(/fields.total/), { target: { value: "60" } });
    const warning = screen.getByText("totals.mismatchTitle").closest('[role="note"]') as HTMLElement;
    fireEvent.click(within(warning).getByRole("button", { name: "totals.useCalculated" }));
    expect((screen.getByLabelText(/fields.total/) as HTMLInputElement).value).toBe("50.00");
    expect(screen.queryByRole("button", { name: "totals.useCalculated" })).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("totals.matches");
  });

  it.each([5000, 6000])("calls a payment covering the total fully paid (%s minor units)", (amount) => {
    const value = draft();
    value.payments = [{ amount: field(amount), paidAt: field("2026-07-20") }];
    mount(value);
    expect(screen.getByText("totals.paidFull")).toBeTruthy();
    expect(screen.queryByText("totals.paid")).toBeNull();
  });

  it("recomputes full payment status from all payments and the edited order total", () => {
    const value = draft();
    value.payments = [
      { amount: field(2000), paidAt: field("2026-07-20") },
      { amount: field(3000), paidAt: field("2026-07-21") },
    ];
    mount(value);
    expect(screen.getByText("totals.paidFull")).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/fields.total/), { target: { value: "60" } });
    expect(screen.getByText("totals.paid")).toBeTruthy();
    expect(screen.queryByText("totals.paidFull")).toBeNull();
  });

  it("only claims full payment while the total is known", () => {
    const value = draft();
    value.totalCost = field(null);
    value.groups[0].products[0].unitPrice = null;
    value.payments = [{ amount: field(5000), paidAt: field("2026-07-20") }];
    mount(value);
    expect(screen.getByText("totals.paidTotal")).toBeTruthy();
    expect(screen.queryByText("totals.paidFull")).toBeNull();
    fireEvent.change(screen.getByLabelText(/fields.total/), { target: { value: "50" } });
    expect(screen.getByText("totals.paidFull")).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/fields.total/), { target: { value: "" } });
    expect(screen.queryByText("totals.paidFull")).toBeNull();
  });
});

describe("review regression: product recovery", () => {
  it.each([false, true])("adds a missed product with one section action when mobile is %s", (mobile) => {
    viewport.mobile = mobile;
    const onSave = mount();
    expect(screen.getAllByRole("button", { name: "create.addProductButton" })).toHaveLength(1);
    addProduct("Manga 2");
    save();
    const saved = onSave.mock.calls[0][0] as ImageIntakeDraft;
    expect(saved.groups.flatMap((group) => group.products.map((product) => product.name))).toEqual([
      "Manga 1",
      "Manga 2",
    ]);
    expect(screen.queryByText("group.categorySuggestedHint")).toBeNull();
  });

  it("removes the final mobile product without leaving an invisible blank that blocks saving", () => {
    viewport.mobile = true;
    const value = draft();
    value.groups.push({
      ...value.groups[0],
      sourcePhrase: "second",
      products: [{ ...value.groups[0].products[0], name: "Manga 2" }],
    });
    value.totalCost = field(10000);
    const onSave = mount(value);
    fireEvent.click(screen.getByRole("button", { name: /^Manga 1/ }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "titleEdit" })).getByRole("button", { name: "delete" }));
    expect(screen.queryByRole("button", { name: /^Manga 1/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^namePlaceholder/ })).toBeNull();
    fireEvent.change(screen.getByLabelText(/fields.total/), { target: { value: "50" } });
    save();
    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave.mock.calls[0][0].groups).toHaveLength(1);
    expect(onSave.mock.calls[0][0].groups[0].products[0].name).toBe("Manga 2");
    addProduct("Manga 3");
    expect(screen.getByRole("button", { name: /^Manga 3/ })).toBeTruthy();
  });
});

describe("review regression: mobile blank recovery", () => {
  it("keeps a blank desktop-created row reachable through the mobile edit sheet", () => {
    viewport.mobile = true;
    const value = draft();
    value.groups[0].products[0].name = "";
    const onSave = mount(value);
    fireEvent.click(screen.getByRole("button", { name: /^namePlaceholder/ }));
    const form = screen.getByRole("dialog", { name: "titleEdit" });
    fireEvent.change(within(form).getByLabelText("nameLabel"), { target: { value: "Recovered product" } });
    fireEvent.click(within(form).getByRole("button", { name: "save" }));
    save();
    expect(onSave.mock.calls[0][0].groups[0].products[0].name).toBe("Recovered product");
  });
});

describe("review regression: category ownership", () => {
  it("keeps one hint only until every model suggestion has been chosen by the collector", () => {
    const value = draft();
    value.groups[0].products[0].suggestedProductTypeKey = "manga";
    value.groups.push({
      ...value.groups[0],
      sourcePhrase: "second",
      products: [{ ...value.groups[0].products[0], name: "Manga 2" }],
    });
    mount(value);
    expect(screen.getAllByText("group.categorySuggestedHint")).toHaveLength(1);
    fireEvent.click(screen.getAllByRole("button", { name: /^Category/ })[0]);
    expect(screen.getAllByText("group.categorySuggestedHint")).toHaveLength(1);
    fireEvent.change(screen.getAllByLabelText("itemNameLabel")[0], { target: { value: "Renamed" } });
    fireEvent.click(screen.getAllByRole("button", { name: /^Category/ })[1]);
    expect(screen.queryByText("group.categorySuggestedHint")).toBeNull();
  });

  it("treats an explicit re-selection of the same category as the collector's choice", () => {
    const value = draft();
    value.groups[0].products[0].suggestedProductTypeKey = "manga";
    viewport.categoryChoice = "manga";
    mount(value);
    expect(screen.getByText("group.categorySuggestedHint")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Category/ }));
    expect(screen.queryByText("group.categorySuggestedHint")).toBeNull();
  });

  it("preserves confirmed categories across mobile and desktop layout switches", () => {
    const value = draft();
    value.groups[0].products[0].suggestedProductTypeKey = "manga";
    value.groups[0].products.push({ ...value.groups[0].products[0], name: "Manga 2" });
    mount(value);
    fireEvent.click(screen.getAllByRole("button", { name: /^Category/ })[0]);
    expect(screen.getByText("group.categorySuggestedHint")).toBeTruthy();
    viewport.mobile = true;
    fireEvent.change(screen.getByLabelText(/fields.total/), { target: { value: "60" } });
    expect(screen.getByText("group.categorySuggestedHint")).toBeTruthy();
    viewport.mobile = false;
    fireEvent.change(screen.getByLabelText(/fields.total/), { target: { value: "70" } });
    fireEvent.click(screen.getAllByRole("button", { name: /^Category/ })[1]);
    expect(screen.queryByText("group.categorySuggestedHint")).toBeNull();
  });

  it("does not mark a newly chosen category as a model suggestion", () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: /^Category/ }));
    expect(screen.queryByText("group.categorySuggestedHint")).toBeNull();
  });
});

describe("review regression: provenance tone", () => {
  it("warns for missing required fields and assumed values while optional and derived values stay neutral", () => {
    const value = draft();
    value.orderDate = field(null);
    value.currency = field("PEN", "assumed");
    value.totalCost = field(null);
    value.groups[0].products[0].unitPrice = null;
    value.store.matchedStoreId = null;
    value.payments = [{ amount: field(null), paidAt: field(null) }];
    mount(value);
    expectWarning("intake-store-change", "missing");
    expectWarning("intake-currency", "provenance.assumed");
    expectWarning("intake-order-date", "provenance.missing");
    expectWarning("intake-total", "provenance.missing");
    expectWarning("intake-payment-amount-0", "provenance.missing");
    expectNeutral("intake-payment-date-0", "provenance.missing");
    expectNeutral("intake-delivery-range", "provenance.missing");
  });

  it("keeps a derived total neutral and an assumed delivery or payment date warning", () => {
    const value = draft();
    value.totalCost = field(null);
    value.delivery = { cost: field(null), expectedFrom: field("2026-09-01", "assumed"), expectedTo: field(null) };
    value.payments = [{ amount: field(1000), paidAt: field("2026-07-21", "assumed") }];
    mount(value);
    expectNeutral("intake-total", "provenance.derived");
    expectWarning("intake-delivery-range", "provenance.assumed");
    expectWarning("intake-payment-date-0", "provenance.assumed");
  });
});

describe("review regression: keyboard and date controls", () => {
  it("does not append a blank product when Tab leaves a source group's final category", () => {
    const value = draft();
    value.groups.push({
      ...value.groups[0],
      sourcePhrase: "second",
      products: [{ ...value.groups[0].products[0], name: "Manga 2" }],
    });
    mount(value);
    const categories = screen.getAllByRole("button", { name: /^Category/ });
    const allowedDefault = fireEvent.keyDown(categories[0], { key: "Tab" });
    expect(allowedDefault).toBe(true);
    expect(screen.getAllByLabelText("itemNameLabel")).toHaveLength(2);
    expect(document.getElementById(categories[1].id)).toBe(categories[1]);
  });

  it("edits the order date through the core calendar and saves the selected civil day", () => {
    const onSave = mount();
    const date = screen.getByLabelText(/fields.orderDate/);
    expect(date.tagName).toBe("BUTTON");
    expect(date.getAttribute("aria-haspopup")).toBe("dialog");
    fireEvent.click(date);
    fireEvent.click(screen.getByRole("button", { name: "Pick August 1" }));
    save();
    expect(onSave.mock.calls[0][0].orderDate.value).toBe("2026-08-01");
  });
});
