import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next-intl", () => ({
  // Interpolates `{name}` for real: the accessible name is the thing under test in the WCAG 2.5.3
  // case below, and a key-only mock would make an assertion about it pass either way.
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    const map: Record<string, string> = {
      mark: "Marcar pagado",
      marked: "Saldado · marcado",
      proven: "Saldado",
      markAria: "Marcar {name} como pagado",
      unmarkAria: "Quitar la marca de pagado de {name}",
      markedHint: "Lo marcaste como pagado. No cambia montos ni recordatorios.",
      "detail.items.paidMark.lockedCancelled": "El pedido está cancelado.",
    };
    const raw = map[key] ?? key;
    return typeof values?.name === "string" ? raw.replace("{name}", values.name) : raw;
  },
}));

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

const actionMock = vi.fn();
vi.mock("../../../_actions/orderItemActions", () => ({
  setOrderItemPaidDeclaredAction: (...args: unknown[]) => actionMock(...args),
}));

import PaidMarkControl from "../PaidMarkControl";

const ORDER_ID = "order-1";
const ITEM_ID = "item-1";
const ITEM_NAME = "Figura Panda";

function renderControl(props: Partial<React.ComponentProps<typeof PaidMarkControl>> = {}) {
  return render(
    <PaidMarkControl
      orderId={ORDER_ID}
      itemId={ITEM_ID}
      itemName={ITEM_NAME}
      initialDeclared={false}
      proven={false}
      // The default is the one shape that offers the mark: no price, no money, no mark yet.
      offersMark
      onError={vi.fn()}
      {...props}
    />,
  );
}

/** Reads the icon lucide painted, the same way a rendered SVG actually identifies itself. */
function paintedIcon(container: HTMLElement): "circle" | "circle-check" | null {
  const svg = container.querySelector("svg");
  if (!svg) return null;
  if (svg.classList.contains("lucide-circle-check")) return "circle-check";
  if (svg.classList.contains("lucide-circle")) return "circle";
  return null;
}

beforeEach(() => {
  actionMock.mockReset();
  refreshMock.mockReset();
});

describe("PaidMarkControl", () => {
  describe("locked by a cancelled order (non-interactive branch)", () => {
    it("renders nothing at all when nothing was marked or proven", () => {
      // A cancelled order cannot offer the mark, so an unmarked, unproven product there has neither
      // a fact to state nor an action to offer. It used to render an inert "Marcar pagado" chip
      // (and, before that, a CircleCheck that made it look settled with nothing backing the claim).
      const { container } = renderControl({ locked: true, initialDeclared: false, proven: false });

      expect(container).toBeEmptyDOMElement();
      expect(screen.queryByText("Marcar pagado")).toBeNull();
      expect(screen.queryByRole("button")).toBeNull();
    });

    it("paints a check when the product was declared paid before cancellation", () => {
      const { container } = renderControl({ locked: true, initialDeclared: true, proven: false });

      expect(paintedIcon(container)).toBe("circle-check");
      expect(screen.getByText("Saldado · marcado")).toBeTruthy();
    });

    it("paints a check when arithmetic already proves the product settled", () => {
      const { container } = renderControl({ locked: true, initialDeclared: false, proven: true });

      expect(paintedIcon(container)).toBe("circle-check");
      expect(screen.getByText("Saldado")).toBeTruthy();
    });
  });

  describe("proven without showMarkWhenProven (non-interactive branch, not locked)", () => {
    it("still paints a check: the proven fact outranks an absent mark", () => {
      const { container } = renderControl({ locked: false, initialDeclared: false, proven: true });

      expect(paintedIcon(container)).toBe("circle-check");
      expect(screen.queryByRole("button")).toBeNull();
    });
  });

  describe("interactive branch", () => {
    it("paints an empty circle for an unmarked, unproven product and stays a button", () => {
      const { container } = renderControl({ locked: false, initialDeclared: false, proven: false });

      expect(paintedIcon(container)).toBe("circle");
      expect(screen.getByRole("button")).toBeTruthy();
    });

    it("paints a check once toggled on, optimistically before the server answers", async () => {
      actionMock.mockResolvedValue({ ok: true });
      const { container } = renderControl({ locked: false, initialDeclared: false, proven: false });

      fireEvent.click(screen.getByRole("button"));

      expect(paintedIcon(container)).toBe("circle-check");
      await waitFor(() => expect(actionMock).toHaveBeenCalledWith(ORDER_ID, ITEM_ID, true));
    });
  });

  describe("availability: where the exact number is known, the number is the answer", () => {
    // #8
    it("renders nothing on a priced product that carries no mark", () => {
      // Not a disabled chip and not a greyed one: nothing. Offering a claim beside a known figure
      // is the second source of truth this rule exists to remove, and a control that cannot act is
      // a tab stop with nothing behind it.
      const { container } = renderControl({ offersMark: false, initialDeclared: false, proven: false });

      expect(container).toBeEmptyDOMElement();
      expect(screen.queryByRole("button")).toBeNull();
    });

    // #8b — the case the `proven: false` version of #8 could not see.
    it("offers no button on a priced product of a fully paid order, on the audit surface too", () => {
      // The 6.8% bug: on the order detail (`showMarkWhenProven`) a priced product with no mark, in
      // an order the arithmetic already proves settled, rendered an INTERACTIVE chip whose
      // accessible name said "Marcar {name} como pagado" over the visible word "Saldado" (WCAG
      // 2.5.3, Label in Name) — and pressing it WROTE `paidDeclaredAt`, arming the deferred
      // contradiction: raise the order's total later and the notice fires with every product marked.
      renderControl({
        offersMark: false,
        initialDeclared: false,
        proven: true,
        showMarkWhenProven: true,
      });

      expect(screen.queryByRole("button")).toBeNull();
      // It still states the fact the arithmetic proves — as a `<span>`, out of the tab order.
      expect(screen.getByText("Saldado")).toBeTruthy();
      expect(screen.queryByLabelText("Marcar Figura Panda como pagado")).toBeNull();
    });

    // #9
    it("still renders, INTERACTIVE, a mark already sitting on a priced product", async () => {
      // The trap this pins down: gate the render on "can the mark be added here" and every existing
      // mark on a priced product becomes impossible to take back.
      actionMock.mockResolvedValue({ ok: true });
      const { container } = renderControl({ offersMark: false, initialDeclared: true, proven: false });

      const button = screen.getByRole("button");
      expect(button).toBeTruthy();
      expect(button).toHaveAttribute("aria-pressed", "true");
      expect(paintedIcon(container)).toBe("circle-check");

      fireEvent.click(button);

      expect(paintedIcon(container)).toBe("circle");
      await waitFor(() => expect(actionMock).toHaveBeenCalledWith(ORDER_ID, ITEM_ID, false));
    });
  });
});
