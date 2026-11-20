import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ModalSheet from "../ModalSheet";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));

const VIEWPORT_HEIGHT = 812;
const OFFSET_PROPERTY = "--sheet-keyboard-offset";
const HEIGHT_PROPERTY = "--sheet-viewport-height";

class MockVisualViewport extends EventTarget {
  height = VIEWPORT_HEIGHT;
  offsetTop = 0;
  scale = 1;

  change(height: number, offsetTop = 0, event = "resize"): void {
    this.height = height;
    this.offsetTop = offsetTop;
    this.dispatchEvent(new Event(event));
  }
}

let viewport: MockVisualViewport;

function renderSheet(isOpen = true) {
  return render(
    <ModalSheet isOpen={isOpen} title="Payment" subtitle="Details" onClose={vi.fn()}>
      <input aria-label="Amount" />
      <textarea aria-label="Note" />
      <button type="button">Other action</button>
    </ModalSheet>,
  );
}

async function expectOffset(sheet: HTMLElement, offset: number): Promise<void> {
  await waitFor(() => expect(sheet.style.getPropertyValue(OFFSET_PROPERTY)).toBe(`${offset}px`));
}

describe("ModalSheet keyboard viewport", () => {
  beforeEach(() => {
    viewport = new MockVisualViewport();
    vi.stubGlobal("visualViewport", viewport);
    vi.stubGlobal("innerHeight", VIEWPORT_HEIGHT);
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("restores exactly zero after keyboard height changes followed by blur and dismissal", async () => {
    renderSheet();
    const sheet = screen.getByRole("dialog");
    vi.spyOn(sheet, "getBoundingClientRect").mockReturnValue({ height: 600, top: 212 } as DOMRect);
    act(() => screen.getByRole("textbox", { name: "Amount" }).focus());
    act(() => viewport.change(500));
    await expectOffset(sheet, 312);
    act(() => viewport.change(420));
    await expectOffset(sheet, 392);
    act(() => screen.getByRole("button", { name: "Other action" }).focus());
    await expectOffset(sheet, 0);
    act(() => viewport.change(VIEWPORT_HEIGHT));
    await expectOffset(sheet, 0);
    expect(sheet.style.height).toBe("");
    expect(sheet.style.bottom).toBe("");
    expect(sheet.style.getPropertyValue(HEIGHT_PROPERTY)).toBe("");
  });

  it("never retains Vaul's inline bottom after a second keyboard resize and focus loss", () => {
    renderSheet();
    const sheet = screen.getByRole("dialog");
    vi.spyOn(sheet, "getBoundingClientRect").mockReturnValue({ height: 600, top: 212 } as DOMRect);
    act(() => screen.getByRole("textbox", { name: "Amount" }).focus());
    act(() => viewport.change(500));
    act(() => viewport.change(420));
    act(() => screen.getByRole("button", { name: "Other action" }).focus());
    act(() => viewport.change(VIEWPORT_HEIGHT));
    expect(sheet.style.bottom).not.toBe("392px");
    expect(sheet.style.height).toBe("");
  });

  it("handles viewport panning and keyboard dismissal while the input stays focused", async () => {
    renderSheet();
    const sheet = screen.getByRole("dialog");
    act(() => screen.getByRole("textbox", { name: "Amount" }).focus());
    act(() => viewport.change(500, 50, "scroll"));
    await expectOffset(sheet, 262);
    expect(sheet.style.getPropertyValue(HEIGHT_PROPERTY)).toBe("500px");
    act(() => viewport.change(VIEWPORT_HEIGHT));
    await expectOffset(sheet, 0);
    expect(screen.getByRole("textbox", { name: "Amount" })).toHaveFocus();
    expect(sheet.style.getPropertyValue(HEIGHT_PROPERTY)).toBe("");
  });

  it("keeps the keyboard offset when focus moves between fields", async () => {
    renderSheet();
    const sheet = screen.getByRole("dialog");
    act(() => screen.getByRole("textbox", { name: "Amount" }).focus());
    act(() => viewport.change(500));
    await expectOffset(sheet, 312);
    act(() => screen.getByRole("textbox", { name: "Note" }).focus());
    await expectOffset(sheet, 312);
  });

  it("scrolls only the sheet body to reveal the focused field", async () => {
    renderSheet();
    const sheet = screen.getByRole("dialog");
    const input = screen.getByRole("textbox", { name: "Amount" });
    const body = input.parentElement!;
    vi.spyOn(body, "getBoundingClientRect").mockReturnValue({ top: 150, bottom: 400 } as DOMRect);
    vi.spyOn(input, "getBoundingClientRect").mockReturnValue({ top: 430, bottom: 474 } as DOMRect);
    const windowScroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    act(() => input.focus());
    act(() => viewport.change(500));
    await expectOffset(sheet, 312);
    expect(body.scrollTop).toBe(74);
    expect(windowScroll).not.toHaveBeenCalled();
  });

  it("recomputes on window resize and ignores pinch zoom or viewport changes without input focus", async () => {
    renderSheet();
    const sheet = screen.getByRole("dialog");
    act(() => viewport.change(500));
    await expectOffset(sheet, 0);
    act(() => screen.getByRole("textbox", { name: "Amount" }).focus());
    await expectOffset(sheet, 312);
    vi.stubGlobal("innerHeight", 700);
    fireEvent.resize(window);
    await expectOffset(sheet, 200);
    viewport.scale = 2;
    act(() => viewport.change(350));
    await expectOffset(sheet, 0);
  });

  it("cleans up pending work and viewport listeners on unmount, then opens without stale geometry", async () => {
    const removeListener = vi.spyOn(viewport, "removeEventListener");
    const cancelFrame = vi.spyOn(window, "cancelAnimationFrame");
    const view = renderSheet();
    const sheet = screen.getByRole("dialog");
    act(() => screen.getByRole("textbox", { name: "Amount" }).focus());
    act(() => viewport.change(500));
    await expectOffset(sheet, 312);
    act(() => viewport.change(420));
    cancelFrame.mockClear();
    view.unmount();
    expect(cancelFrame).toHaveBeenCalled();
    expect(sheet.style.getPropertyValue(OFFSET_PROPERTY)).toBe("0px");
    expect(sheet.style.getPropertyValue(HEIGHT_PROPERTY)).toBe("");
    expect(removeListener).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(removeListener).toHaveBeenCalledWith("scroll", expect.any(Function));
    act(() => viewport.change(VIEWPORT_HEIGHT));
    renderSheet();
    await expectOffset(screen.getByRole("dialog"), 0);
  });

  it("resets geometry when the controlled open flag closes the sheet", async () => {
    const view = renderSheet();
    const sheet = screen.getByRole("dialog");
    act(() => screen.getByRole("textbox", { name: "Amount" }).focus());
    act(() => viewport.change(500));
    await expectOffset(sheet, 312);
    view.rerender(<ModalSheet isOpen={false} title="Payment" onClose={vi.fn()} />);
    await expectOffset(sheet, 0);
    expect(sheet.style.getPropertyValue(HEIGHT_PROPERTY)).toBe("");
    act(() => viewport.change(420));
    await expectOffset(sheet, 0);
  });

  it("falls back to CSS geometry when visualViewport is unavailable", async () => {
    vi.stubGlobal("visualViewport", undefined);
    renderSheet();
    const sheet = screen.getByRole("dialog");
    act(() => screen.getByRole("textbox", { name: "Amount" }).focus());
    await expectOffset(sheet, 0);
    expect(sheet.style.getPropertyValue(HEIGHT_PROPERTY)).toBe("");
  });
});
