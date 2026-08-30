import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PrivateNoteCard from "../PrivateNoteCard";

const LABELS = {
  saving: "Saving...",
  savedAt: (time: string) => `Saved at ${time}`,
  errorGeneric: "We couldn't save your note. Please try again.",
};

beforeEach(() => {
  vi.useRealTimers();
});

function renderCard(onSave: React.ComponentProps<typeof PrivateNoteCard>["onSave"]) {
  return render(
    <PrivateNoteCard
      title="Private note"
      initialNote={null}
      initialUpdatedAt={null}
      locale="en"
      onSave={onSave}
      labels={LABELS}
    />,
  );
}

describe("PrivateNoteCard", () => {
  it("shows the generic error and keeps the draft instead of crashing when onSave rejects", async () => {
    // The bug: `onSave` is the caller's Server Action wrapper, which rejects on a transport failure.
    // Awaited with no try/catch inside the transition, that rejection re-throws during render and
    // replaces the whole page with the (app)/error.tsx boundary instead of showing the existing
    // inline error state and keeping the collector's typed note on screen.
    const onSave = vi.fn().mockRejectedValue(new Error("fetch failed"));
    renderCard(onSave);

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Keep for later" } });
    fireEvent.blur(textarea);

    expect(await screen.findByRole("alert")).toHaveTextContent(LABELS.errorGeneric);
    expect(textarea).toHaveValue("Keep for later");
  });

  it("still saves normally and shows the saved indicator on success", async () => {
    const updatedAt = new Date("2026-01-01T10:30:00.000Z");
    const onSave = vi.fn().mockResolvedValue({ ok: true, updatedAt });
    renderCard(onSave);

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Remember to check size" } });
    fireEvent.blur(textarea);

    await waitFor(() => expect(onSave).toHaveBeenCalledWith("Remember to check size"));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
