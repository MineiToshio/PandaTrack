import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { toggleMock, purgeMock, addToastMock, setVisibleMock, refreshMock, captureMock } = vi.hoisted(() => ({
  toggleMock: vi.fn(),
  purgeMock: vi.fn(),
  addToastMock: vi.fn(),
  setVisibleMock: vi.fn(),
  refreshMock: vi.fn(),
  captureMock: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock, push: vi.fn() }) }));
vi.mock("posthog-js", () => ({ default: { capture: captureMock } }));
vi.mock("@/components/core/Toast", () => ({ useToast: () => ({ addToast: addToastMock }) }));

vi.mock("@/contexts/ProgressionFeedbackContext", () => ({
  useProgressionFeedback: () => ({
    progressionVisible: true,
    setProgressionVisible: setVisibleMock,
    announceProgression: vi.fn(),
  }),
}));

vi.mock("@/app/[locale]/(app)/settings/_actions/progressionActions", () => ({
  toggleProgressionVisibilityAction: toggleMock,
  purgeProgressionLedgerAction: purgeMock,
}));

import SettingsProgressionSection from "../SettingsProgressionSection";

beforeEach(() => {
  vi.clearAllMocks();
  toggleMock.mockResolvedValue({ ok: true });
  purgeMock.mockResolvedValue({ ok: true, deletedEntries: 12, deletedUnlocks: 3 });
});

describe("hide toggle", () => {
  it("hides the layer in the same tick and keeps it hidden when the write succeeds", async () => {
    const user = userEvent.setup();
    render(<SettingsProgressionSection />);

    await user.click(screen.getByRole("switch", { name: "hideRow.label" }));

    expect(setVisibleMock).toHaveBeenNthCalledWith(1, false);
    await waitFor(() => expect(toggleMock).toHaveBeenCalledWith(true));
    expect(setVisibleMock).toHaveBeenCalledTimes(1);
    expect(addToastMock).not.toHaveBeenCalled();
  });

  it("puts the layer back and explains why when the write fails", async () => {
    toggleMock.mockResolvedValue({ ok: false, error: "generic" });
    const user = userEvent.setup();
    render(<SettingsProgressionSection />);

    await user.click(screen.getByRole("switch", { name: "hideRow.label" }));

    await waitFor(() => expect(setVisibleMock).toHaveBeenNthCalledWith(2, true));
    expect(addToastMock).toHaveBeenCalledWith("errors.toggleFailed", { variant: "error" });
  });
});

describe("purge", () => {
  it("does not call the purge until the permanence confirmation is accepted", async () => {
    const user = userEvent.setup();
    render(<SettingsProgressionSection />);

    await user.click(screen.getByRole("button", { name: "purgeRow.action" }));
    expect(purgeMock).not.toHaveBeenCalled();
    expect(screen.getByText("purge.body")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "purge.confirm" }));
    await waitFor(() => expect(purgeMock).toHaveBeenCalledTimes(1));
  });

  it("closes without purging when the confirmation is dismissed", async () => {
    const user = userEvent.setup();
    render(<SettingsProgressionSection />);

    await user.click(screen.getByRole("button", { name: "purgeRow.action" }));
    await user.click(screen.getByRole("button", { name: "purge.cancel" }));

    expect(purgeMock).not.toHaveBeenCalled();
  });

  it("confirms the erase and refreshes the tree once it is done", async () => {
    const user = userEvent.setup();
    render(<SettingsProgressionSection />);

    await user.click(screen.getByRole("button", { name: "purgeRow.action" }));
    await user.click(screen.getByRole("button", { name: "purge.confirm" }));

    await waitFor(() => expect(addToastMock).toHaveBeenCalledWith("purge.success", { variant: "success" }));
    expect(refreshMock).toHaveBeenCalled();
  });

  it("reports a failed erase instead of pretending the history is gone", async () => {
    purgeMock.mockResolvedValue({ ok: false, error: "generic" });
    const user = userEvent.setup();
    render(<SettingsProgressionSection />);

    await user.click(screen.getByRole("button", { name: "purgeRow.action" }));
    await user.click(screen.getByRole("button", { name: "purge.confirm" }));

    await waitFor(() => expect(addToastMock).toHaveBeenCalledWith("errors.purgeFailed", { variant: "error" }));
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
