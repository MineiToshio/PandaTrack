import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import IntakeUploadPanel from "../IntakeUploadPanel";

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => {
    const short = (key: string) => `${namespace.split(".").pop()}.${key}`;
    const translate = (key: string, values?: Record<string, unknown>) =>
      values ? `${short(key)}:${JSON.stringify(values)}` : short(key);
    translate.rich = (key: string, tags: Record<string, (chunks: string) => unknown>) =>
      tags.strong ? tags.strong(short(key)) : short(key);
    return translate;
  },
}));

vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span data-testid="thumb" aria-label={alt} />,
}));

/**
 * A `DataTransfer` stand-in. jsdom implements neither `DataTransfer` nor `DataTransferItemList`, and
 * Testing Library assigns whatever object is handed to it straight onto the event's `dataTransfer` /
 * `clipboardData`, so the shape only has to carry the members the component actually reads.
 */
type TransferEntry = { kind: string; type?: string; file?: File | null };

function makeTransfer(entries: TransferEntry[]): Record<string, unknown> {
  const files = entries.map((entry) => entry.file).filter((file): file is File => Boolean(file));
  return {
    types: ["Files"],
    dropEffect: "none",
    items: entries.map((entry) => ({
      kind: entry.kind,
      type: entry.type ?? "",
      getAsFile: () => entry.file ?? null,
    })),
    files,
  };
}

function imageFile(name = "screenshot.png", type = "image/png"): File {
  return new File(["x"], name, { type });
}

function imageTransfer(...files: File[]): Record<string, unknown> {
  return makeTransfer(files.map((file) => ({ kind: "file", type: file.type, file })));
}

const onFilesAdded = vi.fn();
const onUnsupportedFiles = vi.fn();

function renderPanel(): { surface: HTMLElement; dropzone: HTMLElement } {
  const { container } = render(
    <IntakeUploadPanel
      attachments={[]}
      onFilesAdded={onFilesAdded}
      onUnsupportedFiles={onUnsupportedFiles}
      onRemove={vi.fn()}
      onReorder={vi.fn()}
      onSubmit={vi.fn()}
      remainingPhotos={17}
      overflowExcess={null}
      showFirstTimeExplainer={false}
    />,
  );
  // The drop target is the whole surface, not just the dashed card: a photo released over the
  // thumbnails or the CTA must still attach instead of making the browser navigate to the image.
  const surface = container.firstElementChild as HTMLElement;
  // Reached through its own hint rather than by accessible name: the name changes while a drag is
  // hovering, which is precisely what half of these tests assert on.
  const dropzone = screen.getByText("upload.dropzoneHint").closest("button") as HTMLElement;
  return { surface, dropzone };
}

beforeEach(() => {
  onFilesAdded.mockClear();
  onUnsupportedFiles.mockClear();
});

describe("IntakeUploadPanel drop door", () => {
  it("hands dropped images to the same callback the file picker uses", () => {
    const { surface } = renderPanel();
    const first = imageFile("chat-1.png");
    const second = imageFile("chat-2.webp", "image/webp");

    fireEvent.drop(surface, { dataTransfer: imageTransfer(first, second) });

    expect(onFilesAdded).toHaveBeenCalledTimes(1);
    expect(onFilesAdded).toHaveBeenCalledWith([first, second]);
    expect(onUnsupportedFiles).not.toHaveBeenCalled();
  });

  it("reports the format error and attaches nothing when the drop carries an unsupported file", () => {
    const { surface } = renderPanel();

    fireEvent.drop(surface, {
      dataTransfer: imageTransfer(new File(["x"], "receipt.pdf", { type: "application/pdf" })),
    });

    expect(onUnsupportedFiles).toHaveBeenCalledTimes(1);
    expect(onFilesAdded).not.toHaveBeenCalled();
  });

  it("reports an iPhone HEIC rather than accepting a format the compression step cannot decode", () => {
    const { surface } = renderPanel();

    fireEvent.drop(surface, {
      dataTransfer: imageTransfer(new File(["x"], "IMG_0001.HEIC", { type: "image/heic" })),
    });

    expect(onUnsupportedFiles).toHaveBeenCalledTimes(1);
    expect(onFilesAdded).not.toHaveBeenCalled();
  });

  it("survives a dropped folder, whose item yields no file at all", () => {
    const { surface } = renderPanel();

    expect(() =>
      fireEvent.drop(surface, { dataTransfer: makeTransfer([{ kind: "file", type: "", file: null }]) }),
    ).not.toThrow();

    expect(onFilesAdded).not.toHaveBeenCalled();
    expect(onUnsupportedFiles).toHaveBeenCalledTimes(1);
  });

  it("ignores a dragged text selection without treating it as a refused file", () => {
    const { surface } = renderPanel();

    fireEvent.drop(surface, { dataTransfer: makeTransfer([{ kind: "string", type: "text/plain" }]) });

    expect(onFilesAdded).not.toHaveBeenCalled();
    expect(onUnsupportedFiles).not.toHaveBeenCalled();
  });

  it("attaches what it can and still reports the rest of a mixed drop", () => {
    const { surface } = renderPanel();
    const good = imageFile("chat.png");

    fireEvent.drop(surface, {
      dataTransfer: imageTransfer(good, new File(["x"], "invoice.pdf", { type: "application/pdf" })),
    });

    expect(onFilesAdded).toHaveBeenCalledWith([good]);
    expect(onUnsupportedFiles).toHaveBeenCalledTimes(1);
  });

  it("prevents the default so the browser never opens the dropped image in place of the screen", () => {
    const { surface } = renderPanel();

    const notCancelled = fireEvent.drop(surface, { dataTransfer: imageTransfer(imageFile()) });

    expect(notCancelled).toBe(false);
  });

  it("prevents the default on dragover, without which the drop event never fires at all", () => {
    const { surface } = renderPanel();

    const notCancelled = fireEvent.dragOver(surface, { dataTransfer: imageTransfer(imageFile()) });

    expect(notCancelled).toBe(false);
  });
});

/**
 * The classic dropzone bug: crossing onto a child element fires `dragleave` on the element left
 * behind, so a boolean flag switches the highlight off while the pointer is still inside the zone.
 * These two tests pin the depth counter that replaces it.
 */
describe("IntakeUploadPanel drag highlight", () => {
  it("keeps the highlight on when the drag moves onto a child of the surface", () => {
    const { surface, dropzone } = renderPanel();
    const transfer = imageTransfer(imageFile());

    fireEvent.dragEnter(surface, { dataTransfer: transfer });
    expect(screen.getByText("upload.dropActive")).toBeInTheDocument();

    // Entering the child fires before the parent's leave, exactly as the drag model orders them.
    fireEvent.dragEnter(dropzone, { dataTransfer: transfer });
    fireEvent.dragLeave(surface, { dataTransfer: transfer });

    expect(screen.getByText("upload.dropActive")).toBeInTheDocument();
  });

  it("drops the highlight once the drag really leaves the surface", () => {
    const { surface, dropzone } = renderPanel();
    const transfer = imageTransfer(imageFile());

    fireEvent.dragEnter(surface, { dataTransfer: transfer });
    fireEvent.dragEnter(dropzone, { dataTransfer: transfer });
    fireEvent.dragLeave(dropzone, { dataTransfer: transfer });
    fireEvent.dragLeave(surface, { dataTransfer: transfer });

    expect(screen.queryByText("upload.dropActive")).not.toBeInTheDocument();
    expect(screen.getByText("upload.dropzoneTitle")).toBeInTheDocument();
  });

  it("does not highlight for a drag that carries no files", () => {
    const { surface } = renderPanel();

    fireEvent.dragEnter(surface, { dataTransfer: { types: ["text/plain"], items: [], files: [] } });

    expect(screen.queryByText("upload.dropActive")).not.toBeInTheDocument();
  });

  it("clears the highlight after a drop, so a second drag starts from a clean state", () => {
    const { surface } = renderPanel();
    const transfer = imageTransfer(imageFile());

    fireEvent.dragEnter(surface, { dataTransfer: transfer });
    fireEvent.drop(surface, { dataTransfer: transfer });

    expect(screen.queryByText("upload.dropActive")).not.toBeInTheDocument();
  });
});

describe("IntakeUploadPanel paste door", () => {
  it("attaches an image pasted while nothing is being typed into", () => {
    renderPanel();
    const pasted = imageFile("Screenshot 2026-07-29.png");

    const notCancelled = fireEvent.paste(document.body, { clipboardData: imageTransfer(pasted) });

    expect(onFilesAdded).toHaveBeenCalledWith([pasted]);
    // The image paste is consumed rather than also landing wherever the caret happens to be.
    expect(notCancelled).toBe(false);
  });

  it("never hijacks a paste that came from a field the user is typing in", () => {
    renderPanel();
    render(<input aria-label="assumed total" />);
    const field = screen.getByLabelText("assumed total");

    const notCancelled = fireEvent.paste(field, { clipboardData: imageTransfer(imageFile()) });

    expect(onFilesAdded).not.toHaveBeenCalled();
    // Left uncancelled so the field receives the paste exactly as it would without this listener.
    expect(notCancelled).toBe(true);
  });

  it("never hijacks a paste from a contenteditable region", () => {
    renderPanel();
    const editable = document.createElement("div");
    // jsdom does not derive `isContentEditable` from the attribute, so it is stated outright.
    Object.defineProperty(editable, "isContentEditable", { value: true });
    document.body.appendChild(editable);

    try {
      fireEvent.paste(editable, { clipboardData: imageTransfer(imageFile()) });
      expect(onFilesAdded).not.toHaveBeenCalled();
    } finally {
      editable.remove();
    }
  });

  it("lets a plain-text paste run its normal course", () => {
    renderPanel();

    const notCancelled = fireEvent.paste(document.body, {
      clipboardData: makeTransfer([{ kind: "string", type: "text/plain" }]),
    });

    expect(onFilesAdded).not.toHaveBeenCalled();
    expect(notCancelled).toBe(true);
  });

  it("ignores a paste whose only file is an unsupported format, rather than erroring on it", () => {
    renderPanel();

    fireEvent.paste(document.body, {
      clipboardData: imageTransfer(new File(["x"], "notes.pdf", { type: "application/pdf" })),
    });

    expect(onFilesAdded).not.toHaveBeenCalled();
    expect(onUnsupportedFiles).not.toHaveBeenCalled();
  });

  /**
   * The listener is bound to the document, so a leaked one would keep swallowing image pastes on
   * every screen the user visits afterwards. Unmounting is also how the door closes when the flow
   * leaves the upload phase: this surface only renders in that phase.
   */
  it("removes the document listener on unmount", () => {
    const { unmount } = render(
      <IntakeUploadPanel
        attachments={[]}
        onFilesAdded={onFilesAdded}
        onUnsupportedFiles={onUnsupportedFiles}
        onRemove={vi.fn()}
        onReorder={vi.fn()}
        onSubmit={vi.fn()}
        remainingPhotos={17}
        overflowExcess={null}
        showFirstTimeExplainer={false}
      />,
    );

    unmount();
    fireEvent.paste(document.body, { clipboardData: imageTransfer(imageFile()) });

    expect(onFilesAdded).not.toHaveBeenCalled();
  });
});
