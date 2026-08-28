import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { voidProgressionPointsActionMock, addToastMock, refreshMock } = vi.hoisted(() => ({
  voidProgressionPointsActionMock: vi.fn(),
  addToastMock: vi.fn(),
  refreshMock: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${Object.values(values).join(",")}` : key,
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock }) }));

vi.mock("@/contexts/ToastContext", () => ({ useToast: () => ({ addToast: addToastMock }) }));

vi.mock("@/app/[locale]/(app)/admin/_actions/voidProgressionPoints", () => ({
  voidProgressionPointsAction: voidProgressionPointsActionMock,
}));

/**
 * Renders the canonical modal inline, including its footer actions, so the confirmation contract
 * this component owns (reason gate, pending state, single call) is queryable. `<Modal>` itself has
 * its own tests for focus, ARIA and motion; re-exercising them here would test the wrong thing.
 */
vi.mock("@/components/modules/Modal/Modal", () => ({
  default: ({
    isOpen,
    title,
    subtitle,
    children,
    primaryAction,
    secondaryAction,
  }: {
    isOpen: boolean;
    title: string;
    subtitle?: React.ReactNode;
    children?: React.ReactNode;
    primaryAction?: { label: string; onClick: () => void; disabled?: boolean; loading?: boolean };
    secondaryAction?: { label: string; onClick: () => void; disabled?: boolean };
  }) =>
    isOpen ? (
      <div role="alertdialog" aria-label={title}>
        <p>{subtitle}</p>
        {children}
        {primaryAction && (
          <button
            type="button"
            onClick={primaryAction.onClick}
            disabled={primaryAction.disabled}
            data-loading={String(Boolean(primaryAction.loading))}
          >
            {primaryAction.label}
          </button>
        )}
        {secondaryAction && (
          <button type="button" onClick={secondaryAction.onClick} disabled={secondaryAction.disabled}>
            {secondaryAction.label}
          </button>
        )}
      </div>
    ) : null,
}));

import VoidPointsControl from "../VoidPointsControl";

const PROPS = { targetUserId: "user-1", targetUsername: "toshio", liveEntryCount: 3 };

beforeEach(() => {
  vi.clearAllMocks();
  voidProgressionPointsActionMock.mockResolvedValue({
    success: true,
    voidedEntryCount: 3,
    maturedPoints: 0,
    highestRankIndex: 4,
  });
});

describe("VoidPointsControl", () => {
  it("does not open the confirmation until the action is pressed", () => {
    render(<VoidPointsControl {...PROPS} />);

    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("disables the trigger for a collector with nothing live to void", () => {
    render(<VoidPointsControl {...PROPS} liveEntryCount={0} />);

    expect(screen.getByRole("button", { name: "trigger" }).hasAttribute("disabled")).toBe(true);
  });

  it("names the collector and the number of live entries the void would cover", async () => {
    const user = userEvent.setup();
    render(<VoidPointsControl {...PROPS} />);
    await user.click(screen.getByRole("button", { name: "trigger" }));

    expect(screen.getByText("subtitle:toshio,3")).toBeTruthy();
  });

  it("refuses an empty reason inline and calls no action", async () => {
    const user = userEvent.setup();
    render(<VoidPointsControl {...PROPS} />);
    await user.click(screen.getByRole("button", { name: "trigger" }));
    await user.click(screen.getByRole("button", { name: "confirm" }));

    expect(screen.getByText("reasonRequired")).toBeTruthy();
    expect(voidProgressionPointsActionMock).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toBeTruthy();
  });

  it("refuses a whitespace-only reason the same way", async () => {
    const user = userEvent.setup();
    render(<VoidPointsControl {...PROPS} />);
    await user.click(screen.getByRole("button", { name: "trigger" }));
    await user.type(screen.getByLabelText("reasonLabel"), "   ");
    await user.click(screen.getByRole("button", { name: "confirm" }));

    expect(voidProgressionPointsActionMock).not.toHaveBeenCalled();
  });

  it("voids once with the trimmed reason, then toasts and re-reads the console", async () => {
    const user = userEvent.setup();
    render(<VoidPointsControl {...PROPS} />);
    await user.click(screen.getByRole("button", { name: "trigger" }));
    await user.type(screen.getByLabelText("reasonLabel"), "  Farmed points  ");
    await user.click(screen.getByRole("button", { name: "confirm" }));

    await waitFor(() => expect(voidProgressionPointsActionMock).toHaveBeenCalledTimes(1));
    expect(voidProgressionPointsActionMock).toHaveBeenCalledWith({
      targetUserId: "user-1",
      reason: "Farmed points",
    });
    await waitFor(() => expect(addToastMock).toHaveBeenCalledWith("toast.voided:3", { variant: "success" }));
    expect(refreshMock).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });

  it("waits for the server instead of closing optimistically, and blocks a second submit meanwhile", async () => {
    let release: (value: unknown) => void = () => {};
    voidProgressionPointsActionMock.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );

    const user = userEvent.setup();
    render(<VoidPointsControl {...PROPS} />);
    await user.click(screen.getByRole("button", { name: "trigger" }));
    await user.type(screen.getByLabelText("reasonLabel"), "Farmed points");
    await user.click(screen.getByRole("button", { name: "confirm" }));

    // The surface is still up and reporting work in flight: the recomputed figures only exist
    // server-side, so there is nothing honest to paint before the answer arrives.
    const confirm = await screen.findByRole("button", { name: "confirm" });
    await waitFor(() => expect(confirm.getAttribute("data-loading")).toBe("true"));
    expect(confirm.hasAttribute("disabled")).toBe(true);

    release({ success: true, voidedEntryCount: 3, maturedPoints: 0, highestRankIndex: 4 });
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(voidProgressionPointsActionMock).toHaveBeenCalledTimes(1);
  });

  it("reports a refused void as an error and does not re-read the console", async () => {
    voidProgressionPointsActionMock.mockResolvedValue({ success: false, error: "AUDIT_WRITE_FAILED" });

    const user = userEvent.setup();
    render(<VoidPointsControl {...PROPS} />);
    await user.click(screen.getByRole("button", { name: "trigger" }));
    await user.type(screen.getByLabelText("reasonLabel"), "Farmed points");
    await user.click(screen.getByRole("button", { name: "confirm" }));

    await waitFor(() => expect(addToastMock).toHaveBeenCalledWith("errors.generic", { variant: "error" }));
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
