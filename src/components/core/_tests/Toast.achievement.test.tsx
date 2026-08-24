import { fireEvent, render, screen, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Toast from "@/components/core/Toast/Toast";
import type { ToastItem } from "@/contexts/ToastContext";

// Minimal next-intl mock — the dismiss button's accessible name is the only translated string
vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

const RING = "var(--rarity-holo)";
/** Mirrors EXIT_ANIMATION_MS in the component (the --motion-base container transition). */
const EXIT_MS = 280;

function achievementToast(overrides: Partial<ToastItem> = {}): ToastItem {
  return {
    id: "toast-1",
    message: "Primera importación",
    variant: "achievement",
    duration: 4000,
    achievement: {
      media: <span data-testid="medal-art" />,
      kicker: "Medalla desbloqueada",
      meta: "Holográfica · página 2 · 3 de 12",
      ringVar: RING,
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Toast — achievement variant", () => {
  it("renders the art slot and the three text lines around the medal name", () => {
    render(<Toast toast={achievementToast()} onRemove={vi.fn()} />);

    expect(screen.getByTestId("medal-art")).toBeInTheDocument();
    expect(screen.getByText("Medalla desbloqueada")).toBeInTheDocument();
    expect(screen.getByText("Primera importación")).toBeInTheDocument();
    expect(screen.getByText("Holográfica · página 2 · 3 de 12")).toBeInTheDocument();
  });

  it("keeps the art decorative and states every fact in text", () => {
    render(<Toast toast={achievementToast()} onRemove={vi.fn()} />);

    // The medal art must not be the only carrier of the rarity/series facts (FDD-12 §2.7)
    expect(screen.getByTestId("medal-art").closest("[aria-hidden]")).not.toBeNull();
  });

  it("tints the kicker with the rarity ring token instead of a fixed colour", () => {
    render(<Toast toast={achievementToast()} onRemove={vi.fn()} />);

    expect(screen.getByText("Medalla desbloqueada")).toHaveStyle({ color: RING });
  });

  it("composes the halo over --elevation-3 and the border off the rarity ring", () => {
    render(<Toast toast={achievementToast()} onRemove={vi.fn()} />);
    const root = screen.getByRole("status");

    const inlineStyle = root.getAttribute("style") ?? "";
    expect(inlineStyle).toContain("var(--elevation-3)");
    expect(inlineStyle).toContain(`color-mix(in oklch, ${RING}`);
    // Theme-aware by construction: everything resolves through tokens, never a literal colour
    expect(inlineStyle).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it("tints the countdown hairline with the same rarity ring", () => {
    const { container } = render(<Toast toast={achievementToast()} onRemove={vi.fn()} />);
    const countdown = container.querySelector(".toast-countdown");

    expect(countdown).not.toBeNull();
    expect(countdown?.getAttribute("style") ?? "").toContain(RING);
  });

  it("announces ambiently: role status and aria-live polite, never alert", () => {
    render(<Toast toast={achievementToast()} onRemove={vi.fn()} />);
    const root = screen.getByRole("status");

    expect(root).toHaveAttribute("aria-live", "polite");
    expect(root).toHaveAttribute("aria-atomic", "true");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("still dismisses from the close button", () => {
    const onRemove = vi.fn();
    render(<Toast toast={achievementToast()} onRemove={onRemove} />);

    fireEvent.click(screen.getByRole("button", { name: "common.dismiss" }));
    expect(onRemove).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(EXIT_MS);
    });
    expect(onRemove).toHaveBeenCalledWith("toast-1");
  });

  it("still auto-dismisses after its duration", () => {
    const onRemove = vi.fn();
    render(<Toast toast={achievementToast({ duration: 4000 })} onRemove={onRemove} />);

    act(() => {
      vi.advanceTimersByTime(3999);
    });
    expect(onRemove).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1 + EXIT_MS);
    });
    expect(onRemove).toHaveBeenCalledWith("toast-1");
  });
});

describe("Toast — non-achievement variants stay untouched", () => {
  const successToast: ToastItem = {
    id: "toast-2",
    message: "Pedido guardado",
    variant: "success",
    duration: 4000,
  };

  it("renders the single message line with no achievement chrome", () => {
    const { container } = render(<Toast toast={successToast} onRemove={vi.fn()} />);
    const root = screen.getByRole("status");

    expect(screen.getByText("Pedido guardado")).toBeInTheDocument();
    expect(root.getAttribute("style")).toBeNull();
    expect(root.className).toContain("shadow-lg");
    expect(root.className).toContain("border-success/20");
    expect(container.querySelector(".toast-countdown")?.className).toContain("bg-success");
  });

  it("still auto-dismisses on its own timer", () => {
    const onRemove = vi.fn();
    render(<Toast toast={successToast} onRemove={onRemove} />);

    act(() => {
      vi.advanceTimersByTime(4000 + EXIT_MS);
    });
    expect(onRemove).toHaveBeenCalledWith("toast-2");
  });
});

describe("Toast — reduced motion (motion.md §4 'Toast enter/exit')", () => {
  it.each([
    ["achievement", achievementToast()],
    ["success", { id: "toast-3", message: "Pedido guardado", variant: "success", duration: 4000 } satisfies ToastItem],
  ])("gates the entrance slide behind motion-safe for the %s variant", (_name, toast) => {
    render(<Toast toast={toast} onRemove={vi.fn()} />);
    const root = screen.getByRole("status");

    // Under prefers-reduced-motion the toast appears without travelling, so the offset must be
    // motion-safe-only. A bare `translate-x-4` would slide regardless of the user's OS setting.
    expect(root.className).toContain("motion-safe:translate-x-4");
    expect(root.className).not.toMatch(/(^|\s)translate-x-4(\s|$)/);
    // The fade is untouched: reduced means reduced, not none
    expect(root.className).toContain("opacity-0");
  });

  it("keeps the dismiss timer running regardless of the slide treatment", () => {
    const onRemove = vi.fn();
    render(<Toast toast={achievementToast()} onRemove={onRemove} />);

    act(() => {
      vi.advanceTimersByTime(4000 + EXIT_MS);
    });
    expect(onRemove).toHaveBeenCalledWith("toast-1");
  });
});
