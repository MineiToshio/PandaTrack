import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import StoreLogoZoom from "../StoreLogoZoom";

const { captureMock } = vi.hoisted(() => ({ captureMock: vi.fn() }));

vi.mock("posthog-js", () => ({ default: { capture: captureMock } }));

// The canonical Modal picks dialog vs bottom sheet from this hook; pinning it to desktop keeps the
// assertions on one branch. Both branches share the same public contract.
vi.mock("@/hooks/useIsMobile", () => ({ useIsMobile: () => false }));

const OPEN_LABEL = "Ver el logo de Akabane más grande";

function renderZoom() {
  return render(
    <StoreLogoZoom storeName="Akabane" logoSrc="https://cdn.test/akabane.webp" size={56} openLabel={OPEN_LABEL} />,
  );
}

describe("StoreLogoZoom", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes the logo as a real button, not a click handler on an image", async () => {
    renderZoom();
    const trigger = screen.getByRole("button", { name: OPEN_LABEL });
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    // Nothing is open until asked.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens a labelled dialog showing the logo", async () => {
    const user = userEvent.setup();
    renderZoom();

    await user.click(screen.getByRole("button", { name: OPEN_LABEL }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    // The store name titles the dialog, which is what names it for assistive tech.
    expect(screen.getByText("Akabane")).toBeInTheDocument();
  });

  it("returns focus to the trigger when the dialog closes", async () => {
    const user = userEvent.setup();
    renderZoom();
    const trigger = screen.getByRole("button", { name: OPEN_LABEL });

    await user.click(trigger);
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // The most common lightbox failure is focus leaking behind the closed overlay.
    expect(trigger).toHaveFocus();
  });

  it("reports the zoom so the feature can be measured", async () => {
    const user = userEvent.setup();
    renderZoom();

    await user.click(screen.getByRole("button", { name: OPEN_LABEL }));

    expect(captureMock).toHaveBeenCalledWith("store_logo_zoom_opened");
  });
});
