import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import StatusChip from "@/components/core/StatusChip";

// Minimal next-intl mock — returns a predictable string so label assertions are stable
vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string, values?: Record<string, unknown>) => {
    if (values && typeof values.days === "number") {
      return `${namespace}.${key}:days=${values.days}`;
    }
    if (values && typeof values.pct === "number") {
      return `${namespace}.${key}:pct=${values.pct}`;
    }
    return `${namespace}.${key}`;
  },
}));

describe("StatusChip — orderStatus", () => {
  it.each([
    ["OPEN", "components.statusChip.orderStatus.OPEN"],
    ["PARTIALLY_IN_TRANSIT", "components.statusChip.orderStatus.PARTIALLY_IN_TRANSIT"],
    ["IN_TRANSIT", "components.statusChip.orderStatus.IN_TRANSIT"],
    ["PARTIALLY_DELIVERED", "components.statusChip.orderStatus.PARTIALLY_DELIVERED"],
    ["COMPLETED", "components.statusChip.orderStatus.COMPLETED"],
    ["CANCELLED", "components.statusChip.orderStatus.CANCELLED"],
  ] as const)("renders label for %s", (value, expected) => {
    render(<StatusChip kind="orderStatus" value={value} />);
    expect(screen.getByText(expected)).toBeTruthy();
  });
});

describe("StatusChip — deliveryStatus", () => {
  it("renders IN_TRANSIT label when not overdue", () => {
    render(<StatusChip kind="deliveryStatus" value="IN_TRANSIT" />);
    expect(screen.getByText("components.statusChip.deliveryStatus.IN_TRANSIT")).toBeTruthy();
  });

  it("renders overdue label when IN_TRANSIT and overdueDays >= 1", () => {
    render(<StatusChip kind="deliveryStatus" value="IN_TRANSIT" overdueDays={3} />);
    expect(screen.getByText("components.statusChip.deliveryStatus.overdue:days=3")).toBeTruthy();
  });

  it("does not render overdue label when overdueDays is 0", () => {
    render(<StatusChip kind="deliveryStatus" value="IN_TRANSIT" overdueDays={0} />);
    expect(screen.getByText("components.statusChip.deliveryStatus.IN_TRANSIT")).toBeTruthy();
  });

  it("renders DELIVERED label", () => {
    render(<StatusChip kind="deliveryStatus" value="DELIVERED" />);
    expect(screen.getByText("components.statusChip.deliveryStatus.DELIVERED")).toBeTruthy();
  });

  it("renders CANCELLED label", () => {
    render(<StatusChip kind="deliveryStatus" value="CANCELLED" />);
    expect(screen.getByText("components.statusChip.deliveryStatus.CANCELLED")).toBeTruthy();
  });
});

describe("StatusChip — itemDeliveryState", () => {
  it.each([
    ["NONE", "components.statusChip.itemDeliveryState.NONE"],
    ["ARRIVED_AT_STORE", "components.statusChip.itemDeliveryState.ARRIVED_AT_STORE"],
    ["IN_TRANSIT", "components.statusChip.itemDeliveryState.IN_TRANSIT"],
    ["DELIVERED", "components.statusChip.itemDeliveryState.DELIVERED"],
  ] as const)("renders label for %s", (value, expected) => {
    render(<StatusChip kind="itemDeliveryState" value={value} />);
    expect(screen.getByText(expected)).toBeTruthy();
  });
});

describe("StatusChip — derived", () => {
  it("renders paid label", () => {
    render(<StatusChip kind="derived" value="paid" />);
    expect(screen.getByText("components.statusChip.derived.paid")).toBeTruthy();
  });

  it("renders unpaid label", () => {
    render(<StatusChip kind="derived" value="unpaid" />);
    expect(screen.getByText("components.statusChip.derived.unpaid")).toBeTruthy();
  });

  it("renders overdue label with days", () => {
    render(<StatusChip kind="derived" value="overdue" days={5} />);
    expect(screen.getByText("components.statusChip.derived.overdue:days=5")).toBeTruthy();
  });

  it("renders partial label with pct", () => {
    render(<StatusChip kind="derived" value="partial" pct={60} />);
    expect(screen.getByText("components.statusChip.derived.partial:pct=60")).toBeTruthy();
  });

  // Edge cases per spec
  it("partial at pct=0 falls back to unpaid label", () => {
    render(<StatusChip kind="derived" value="partial" pct={0} />);
    expect(screen.getByText("components.statusChip.derived.unpaid")).toBeTruthy();
  });

  it("partial at pct=100 falls back to paid label", () => {
    render(<StatusChip kind="derived" value="partial" pct={100} />);
    expect(screen.getByText("components.statusChip.derived.paid")).toBeTruthy();
  });
});

describe("StatusChip — info kind", () => {
  it("renders icon and label", () => {
    render(<StatusChip kind="info" icon={<span data-testid="icon" />} label="Test info" />);
    expect(screen.getByText("Test info")).toBeTruthy();
    expect(screen.getByTestId("icon")).toBeTruthy();
  });
});

describe("StatusChip — ad-hoc variant kinds", () => {
  it.each(["success", "warning", "destructive", "accent", "neutral"] as const)("renders label for %s kind", (kind) => {
    render(<StatusChip kind={kind} label="Custom label" />);
    expect(screen.getByText("Custom label")).toBeTruthy();
  });
});

describe("StatusChip — ariaLabel prop", () => {
  it("applies aria-label when provided", () => {
    render(<StatusChip kind="derived" value="paid" ariaLabel="Estado de pago: pagado" />);
    expect(screen.getByLabelText("Estado de pago: pagado")).toBeTruthy();
  });
});
