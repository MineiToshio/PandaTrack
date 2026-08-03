import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import IntakeUploadPanel, { type IntakeAttachment } from "../IntakeUploadPanel";

// Namespace-aware, so the two namespaces this screen reads (`upload`, `quota`) stay distinguishable,
// and strict about rich messages, so a plain `t` on a tagged line fails here as it would in next-intl.
vi.mock("next-intl", async () => {
  const { createTranslationsStub } = await import("./intlStub");
  return { useTranslations: createTranslationsStub() };
});

vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span data-testid="thumb" aria-label={alt} />,
}));

function makeAttachments(count: number): IntakeAttachment[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `attachment-${index}`,
    file: new File(["x"], `photo-${index}.png`, { type: "image/png" }),
    previewUrl: "",
  }));
}

function renderPanel(overrides: Partial<React.ComponentProps<typeof IntakeUploadPanel>> = {}): { submit: HTMLElement } {
  render(
    <IntakeUploadPanel
      attachments={makeAttachments(0)}
      onFilesAdded={vi.fn()}
      onUnsupportedFiles={vi.fn()}
      onRemove={vi.fn()}
      onReorder={vi.fn()}
      onSubmit={vi.fn()}
      remainingPhotos={17}
      overflowExcess={null}
      showFirstTimeExplainer={false}
      {...overrides}
    />,
  );
  return { submit: screen.getByRole("button", { name: "upload.submit" }) };
}

describe("IntakeUploadPanel quota surfaces", () => {
  it("shows the passive counter and never a pre-confirmation dialog", () => {
    renderPanel();

    expect(screen.getByText('quota.counter:{"count":17}')).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps the extraction action enabled while the batch fits", () => {
    const { submit } = renderPanel({ attachments: makeAttachments(3) });

    expect(submit).not.toBeDisabled();
    expect(screen.queryByText(/quota\.overflow/)).not.toBeInTheDocument();
  });

  it("interrupts with both numbers and disables the action when the batch does not fit", () => {
    const { submit } = renderPanel({ attachments: makeAttachments(5), remainingPhotos: 3, overflowExcess: 2 });

    expect(screen.getByText('quota.overflow:{"attached":5,"remaining":3,"excess":2}')).toBeInTheDocument();
    expect(submit).toBeDisabled();
  });

  it("announces the interruption politely rather than as an alert", () => {
    renderPanel({ attachments: makeAttachments(5), remainingPhotos: 3, overflowExcess: 2 });

    // Scoped to the overflow message: the attachment list carries a polite live region of its own
    // for reorder announcements, so "there is a status role somewhere" is no longer specific enough.
    const overflow = screen.getByText('quota.overflow:{"attached":5,"remaining":3,"excess":2}');
    expect(overflow.closest('[role="status"]')).not.toBeNull();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("hides every quota line for an uncapped collector", () => {
    const { submit } = renderPanel({ attachments: makeAttachments(30), remainingPhotos: null, overflowExcess: null });

    expect(screen.queryByText(/quota\.counter/)).not.toBeInTheDocument();
    expect(screen.queryByText(/quota\.helper/)).not.toBeInTheDocument();
    expect(submit).not.toBeDisabled();
  });

  it("shows the explainer only when the surface reports it has not been seen", () => {
    const { unmount } = render(
      <IntakeUploadPanel
        attachments={[]}
        onFilesAdded={vi.fn()}
        onUnsupportedFiles={vi.fn()}
        onRemove={vi.fn()}
        onReorder={vi.fn()}
        onSubmit={vi.fn()}
        remainingPhotos={20}
        overflowExcess={null}
        showFirstTimeExplainer
      />,
    );
    expect(screen.getByText("quota.explainer")).toBeInTheDocument();
    unmount();

    renderPanel();
    expect(screen.queryByText("quota.explainer")).not.toBeInTheDocument();
  });
});

/**
 * The advice to attach the product page belongs before the extraction, not after it: a read is a
 * single pass over the whole batch, so a screenshot added later costs every photo again. It reaches
 * a minority of orders, though, so it stays on the second level of the guidance: present on this
 * screen, one click away, never in front of the collectors it does not concern.
 */
describe("IntakeUploadPanel link hint", () => {
  /**
   * Presence in the DOM proves nothing here: the collapsed body is a `hidden` paragraph, so it is in
   * the document whether the disclosure works, is stuck open, or has lost its trigger entirely. The
   * assertions therefore pin the three things that make it a disclosure: a trigger that says it is
   * collapsed, a body that is really not visible, and the wiring between them.
   */
  it("offers the product page advice on this screen, behind its own trigger", () => {
    renderPanel();

    const trigger = screen.getByRole("button", { name: /upload\.linkHintToggle/ });
    const body = screen.getByText("upload.linkHint");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("aria-controls", body.id);
    expect(body).not.toBeVisible();
  });

  it("keeps the suggestion at helper weight rather than as an alert", () => {
    renderPanel();

    // The one banner on this screen is the guidance note; nothing here escalates to an alert.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("upload.linkHint").closest('[role="note"]')).toBeNull();
  });
});
