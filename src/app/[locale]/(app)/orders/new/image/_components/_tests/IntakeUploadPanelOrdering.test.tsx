import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import enImageIntake from "@/i18n/locales/en/imageIntake.json";
import esImageIntake from "@/i18n/locales/es/imageIntake.json";
import IntakeUploadPanel, { type IntakeAttachment } from "../IntakeUploadPanel";

// The strict stub, because the guidance lines asserted below are rich messages: it refuses a plain
// `t` on a tagged message exactly as next-intl does.
vi.mock("next-intl", async () => {
  const { createTranslationsStub } = await import("./intlStub");
  return { useTranslations: createTranslationsStub() };
});

vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span data-testid="thumb" aria-label={alt} />,
}));

const onReorder = vi.fn();

function attachment(name: string): IntakeAttachment {
  return {
    id: `id-${name}`,
    file: new File(["x"], name, { type: "image/png" }),
    previewUrl: `blob:${name}`,
  };
}

function renderPanel(attachments: IntakeAttachment[]) {
  return render(
    <IntakeUploadPanel
      attachments={attachments}
      onFilesAdded={vi.fn()}
      onUnsupportedFiles={vi.fn()}
      onRemove={vi.fn()}
      onReorder={onReorder}
      onSubmit={vi.fn()}
      remainingPhotos={17}
      overflowExcess={null}
      hasUnreadablePhotos={false}
      showFirstTimeExplainer={false}
    />,
  );
}

/**
 * jsdom implements no `DataTransfer`, and Testing Library assigns whatever object it is handed onto
 * the event, so the stand-in only needs the members the reorder path reads.
 */
function reorderTransfer(): Record<string, unknown> {
  const store = new Map<string, string>();
  return {
    // Deliberately not "Files": the surface-wide file dropzone keys off that type, and an internal
    // reorder must not look like an incoming file drop.
    types: ["text/plain"],
    effectAllowed: "none",
    dropEffect: "none",
    setData: (format: string, value: string) => store.set(format, value),
    getData: (format: string) => store.get(format) ?? "",
    items: [],
    files: [],
  };
}

/** The attachment tiles only: the guidance block above the dropzone is a list of its own. */
function tiles(): HTMLElement[] {
  return within(screen.getByRole("list", { name: "upload.listLabel" })).getAllByRole("listitem");
}

beforeEach(() => {
  onReorder.mockClear();
});

/**
 * The order of the attachments is not decoration: the extraction reads them as one conversation
 * from the first to the last. Everything below protects the collector's ability to see that order
 * and to correct it, including without a pointer.
 */
describe("IntakeUploadPanel attachment order", () => {
  it("numbers every attachment so the reading order is visible without counting tiles", () => {
    renderPanel([attachment("a.png"), attachment("b.png"), attachment("c.png")]);

    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    // The badge is a number on screen and a full sentence for a screen reader.
    expect(screen.getByText('upload.position:{"position":2}')).toBeInTheDocument();
  });

  it("moves an attachment when it is dragged onto another one", () => {
    renderPanel([attachment("a.png"), attachment("b.png"), attachment("c.png")]);
    const [first, , third] = tiles();
    const dataTransfer = reorderTransfer();

    fireEvent.dragStart(third, { dataTransfer });
    fireEvent.dragOver(first, { dataTransfer });
    fireEvent.drop(first, { dataTransfer });

    expect(onReorder).toHaveBeenCalledTimes(1);
    expect(onReorder).toHaveBeenCalledWith(2, 0);
  });

  it("ignores a drop that lands back on the tile the drag started from", () => {
    renderPanel([attachment("a.png"), attachment("b.png")]);
    const [first] = tiles();
    const dataTransfer = reorderTransfer();

    fireEvent.dragStart(first, { dataTransfer });
    fireEvent.dragOver(first, { dataTransfer });
    fireEvent.drop(first, { dataTransfer });

    expect(onReorder).not.toHaveBeenCalled();
  });

  it("keeps the reorder drag out of the file dropzone's way", () => {
    renderPanel([attachment("a.png"), attachment("b.png")]);
    const [first, second] = tiles();
    const dataTransfer = reorderTransfer();

    fireEvent.dragStart(second, { dataTransfer });
    fireEvent.dragOver(first, { dataTransfer });

    // The transfer never announces files, so the surface must not switch to its drop-active state
    // and invite the user to release an image that is not there.
    expect(screen.queryByText("upload.dropActive")).not.toBeInTheDocument();
  });
});

/**
 * Dragging needs a pointer, and no drag event fires on a touch screen at all, so the arrow controls
 * are the guaranteed path to the same reorder rather than a convenience.
 */
describe("IntakeUploadPanel keyboard reordering", () => {
  it("moves an attachment earlier and later from controls that name what they move", async () => {
    const user = userEvent.setup();
    renderPanel([attachment("a.png"), attachment("b.png"), attachment("c.png")]);

    await user.click(screen.getByRole("button", { name: 'upload.moveEarlier:{"position":2}' }));
    expect(onReorder).toHaveBeenLastCalledWith(1, 0);

    await user.click(screen.getByRole("button", { name: 'upload.moveLater:{"position":2}' }));
    expect(onReorder).toHaveBeenLastCalledWith(1, 2);
  });

  it("is reachable by keyboard alone", async () => {
    const user = userEvent.setup();
    renderPanel([attachment("a.png"), attachment("b.png")]);

    const moveLater = screen.getByRole("button", { name: 'upload.moveLater:{"position":1}' });
    moveLater.focus();
    await user.keyboard("{Enter}");

    expect(onReorder).toHaveBeenCalledWith(0, 1);
  });

  it("offers no move that would fall off either end of the list", () => {
    renderPanel([attachment("a.png"), attachment("b.png")]);

    expect(screen.getByRole("button", { name: 'upload.moveEarlier:{"position":1}' })).toBeDisabled();
    expect(screen.getByRole("button", { name: 'upload.moveLater:{"position":2}' })).toBeDisabled();
    expect(screen.getByRole("button", { name: 'upload.moveLater:{"position":1}' })).toBeEnabled();
  });

  it("offers no reorder control at all when there is a single attachment", () => {
    renderPanel([attachment("a.png")]);

    expect(screen.queryByRole("button", { name: 'upload.moveEarlier:{"position":1}' })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: 'upload.moveLater:{"position":1}' })).not.toBeInTheDocument();
  });

  it("announces the new position, the only evidence a reorder happened without sight", async () => {
    const user = userEvent.setup();
    renderPanel([attachment("a.png"), attachment("b.png"), attachment("c.png")]);

    const liveRegion = screen.getByRole("status");
    expect(liveRegion.textContent).toBe("");

    await user.click(screen.getByRole("button", { name: 'upload.moveLater:{"position":1}' }));

    expect(liveRegion).toHaveTextContent('upload.reorderAnnouncement:{"position":2,"total":3}');
  });

  it("announces a drag the same way, since the grid rearranges silently either way", () => {
    renderPanel([attachment("a.png"), attachment("b.png")]);
    const [first, second] = tiles();
    const dataTransfer = reorderTransfer();

    fireEvent.dragStart(first, { dataTransfer });
    fireEvent.dragOver(second, { dataTransfer });
    fireEvent.drop(second, { dataTransfer });

    expect(screen.getByRole("status")).toHaveTextContent('upload.reorderAnnouncement:{"position":2,"total":2}');
  });
});

/**
 * The advice a collector can only act on BEFORE pressing the button, since a read is a single pass
 * over the whole batch and a correction afterwards costs every photo again.
 *
 * Two levels, and which advice sits on which level is the point: the rules that decide how the whole
 * batch is read apply to every submission, so they are read without asking; the product-sheet advice
 * applies to a minority of them, so it waits behind a trigger instead of taxing everyone's attention.
 */
describe("IntakeUploadPanel upload guidance", () => {
  function guidanceRegion(): HTMLElement {
    return screen.getByRole("region", { name: "upload.guidanceLabel" });
  }

  it("states the one-order rule without asking for any interaction", () => {
    renderPanel([]);

    const note = within(guidanceRegion()).getByRole("note");
    expect(note).toHaveTextContent("upload.guidanceOneOrder");
    expect(note).toBeVisible();
  });

  /**
   * The line the extraction prompt depends on: it tells the model the images are one conversation in
   * the order they were attached, and product sheets are attached last. Nothing else on this screen
   * says the position is read, and it has to be said before the photos are picked, so it cannot be
   * folded into a disclosure or into the reorder hint that appears after the second photo.
   */
  it("states that the order is read, and where the product pages go, with no interaction", () => {
    renderPanel([]);

    const note = within(guidanceRegion()).getByRole("note");
    expect(note).toHaveTextContent("upload.guidanceOrder");
    expect(within(note).getByText("upload.guidanceOrder")).toBeVisible();
  });

  it("keeps the guidance at note weight rather than as an alert", () => {
    renderPanel([]);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("leaves the product-sheet advice collapsed behind a labelled trigger", () => {
    renderPanel([]);

    const trigger = screen.getByRole("button", { name: /upload\.linkHintToggle/ });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("upload.linkHint")).not.toBeVisible();
  });

  it("opens the product-sheet advice from the keyboard", async () => {
    const user = userEvent.setup();
    renderPanel([]);

    const trigger = screen.getByRole("button", { name: /upload\.linkHintToggle/ });
    trigger.focus();
    await user.keyboard("{Enter}");

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const body = screen.getByText("upload.linkHint");
    expect(body).toBeVisible();
    expect(trigger).toHaveAttribute("aria-controls", body.id);
  });

  it("explains how to reorder only once there is more than one photo to reorder", () => {
    const { unmount } = renderPanel([attachment("a.png")]);
    expect(screen.queryByText("upload.reorderHint")).not.toBeInTheDocument();
    // The division of labour between the two lines: the guidance says the order is read, the hint
    // beside the grid says how to change it, and the hint waits until there is something to move.
    expect(within(guidanceRegion()).queryByText("upload.reorderHint")).not.toBeInTheDocument();
    unmount();

    renderPanel([attachment("a.png"), attachment("b.png")]);
    expect(screen.getByText("upload.reorderHint")).toBeInTheDocument();
  });
});

describe("intake upload copy", () => {
  it("defines every upload string in both locales", () => {
    expect(Object.keys(enImageIntake.upload).sort()).toEqual(Object.keys(esImageIntake.upload).sort());
  });

  /**
   * A ceiling on the INSTRUCTIONAL BLOCK, which is not the same measurement as `ux-copy.md` §1's
   * ~30 words per screen: the whole upload screen at rest reads about 87 words in Spanish once the
   * counter, the dropzone labels, the two helper lines and the CTA are counted, and it has never
   * been inside that budget. What this pins is the part a collector must read before they can act:
   * the heading, the purpose line, the two always-visible rules and the disclosure trigger. Naming
   * it honestly matters, because calling it "the screen budget" is what let the conversation-order
   * rule be deleted to buy words the screen was never going to have.
   *
   * The body behind the disclosure is excluded: it costs nothing until it is asked for.
   */
  it("keeps the instructional block above the dropzone inside its 40-word ceiling", () => {
    // A token counts only if it carries a letter or a digit: stripping a tag leaves stray
    // punctuation ("</strong>:" becomes " :"), and counting that as a word inflates the total.
    const countWords = (value: string) =>
      value
        .replace(/<\/?[a-z]+>/g, " ")
        .split(/\s+/)
        .filter((token) => /[\p{L}\p{N}]/u.test(token)).length;

    for (const catalog of [esImageIntake, enImageIntake]) {
      const block = [
        catalog.upload.title,
        catalog.upload.description,
        catalog.upload.guidanceOneOrder,
        catalog.upload.guidanceOrder,
        catalog.upload.linkHintToggle,
      ];
      expect(block.reduce((total, line) => total + countWords(line), 0)).toBeLessThanOrEqual(40);
    }
  });

  it("emphasises the rule inside each guidance line with a strong tag in both locales", () => {
    for (const catalog of [esImageIntake, enImageIntake]) {
      expect(catalog.upload.guidanceOneOrder).toMatch(/<strong>.+<\/strong>/);
      expect(catalog.upload.guidanceOrder).toMatch(/<strong>.+<\/strong>/);
    }
  });
});
