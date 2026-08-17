import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
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

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams("store=store-1"),
}));

vi.mock("posthog-js", () => ({ default: { capture: vi.fn() } }));
vi.mock("../DiscrepancyModal", () => ({ default: () => null }));

const STORES: OrderStoreOption[] = [{ id: "store-1", name: "Pop Dealer", countryCode: "PE" }];

const actionMock = vi.fn().mockResolvedValue({ success: false, error: "validation" });

async function clickFirst(name: string) {
  const [button] = screen.getAllByRole("button", { name });
  await userEvent.click(button!);
}

/**
 * The order create form serializes its picker dates to `yyyy-mm-dd` for `FormData`. It used to do
 * that with `toISOString().split("T")[0]`, which converts to UTC first — so for a viewer EAST of
 * UTC the picker's local midnight rolls back into the PREVIOUS day and is saved as that day. Lima
 * is west of UTC, where the wrong serializer happens to produce the right day, which is why the
 * collection shows no damage from it and why the defect survived: it is invisible from the only
 * timezone anyone tested in.
 *
 * Pinned to a real instant where the two calendar days genuinely differ (20:00Z is already the next
 * day in Tokyo), because at most UTC hours they agree and the test would pass either way.
 */
describe("OrderCreateForm domain-date serialization (positive-offset timezone)", () => {
  const originalTz = process.env.TZ;

  beforeAll(() => {
    process.env.TZ = "Asia/Tokyo";
  });

  afterAll(() => {
    process.env.TZ = originalTz;
  });

  beforeEach(() => {
    actionMock.mockClear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // 2026-08-10T20:00:00Z is 2026-08-11 05:00 in Tokyo: UTC day 10, local day 11.
    vi.setSystemTime(new Date("2026-08-10T20:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("submits the collector's LOCAL calendar day as orderDate, not the UTC one", async () => {
    render(<OrderCreateForm stores={STORES} productTypeKeys={[]} baseCurrencyCode="USD" action={actionMock} />);

    await clickFirst("stepContinue");
    await userEvent.type(screen.getByPlaceholderText("itemNamePlaceholder"), "Figura");
    await userEvent.type(screen.getByPlaceholderText("totalCostPlaceholder"), "100");
    await clickFirst("stepContinue");
    await clickFirst("confirmCta");

    await waitFor(() => expect(actionMock).toHaveBeenCalled());
    const submitted = actionMock.mock.calls[0]![1] as FormData;
    // The old serializer produced "2026-08-10" here.
    expect(submitted.get("orderDate")).toBe("2026-08-11");
  });
});
