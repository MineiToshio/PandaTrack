import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AlertTriangle } from "lucide-react";
import Modal from "@/components/modules/Modal/Modal";

// ModalHeader resolves the close button's accessible name via useTranslations("common") when
// callers do not pass an explicit closeButtonLabel; these tests exercise other Modal behavior, so
// the stub returns the key unchanged.
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

describe("Modal — open state", () => {
  it("renders title when open", () => {
    render(
      <Modal isOpen onClose={() => null} title="Hello">
        <p>body</p>
      </Modal>,
    );
    expect(screen.getByText("Hello")).toBeTruthy();
    expect(screen.getByText("body")).toBeTruthy();
  });

  it("renders nothing when closed", () => {
    render(
      <Modal isOpen={false} onClose={() => null} title="Hidden">
        <p>body</p>
      </Modal>,
    );
    expect(screen.queryByText("Hidden")).toBeNull();
  });
});

describe("Modal — semantic depth icon (ADR 0008)", () => {
  it("renders the icon in the tonal circle when `icon` prop is provided", () => {
    render(
      <Modal
        isOpen
        onClose={() => null}
        title="Reportar"
        icon={<AlertTriangle data-testid="modal-icon" />}
        tone="warning"
      >
        <p>body</p>
      </Modal>,
    );
    expect(screen.getByTestId("modal-icon")).toBeTruthy();
  });
});

describe("Modal — actions", () => {
  it("invokes primaryAction.onClick", () => {
    const onPrimary = vi.fn();
    render(
      <Modal isOpen onClose={() => null} title="x" primaryAction={{ label: "Send", onClick: onPrimary }}>
        <p>body</p>
      </Modal>,
    );
    fireEvent.click(screen.getByText("Send"));
    expect(onPrimary).toHaveBeenCalled();
  });

  it("invokes onClose when Escape is pressed and dismissible", () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="x">
        <p>body</p>
      </Modal>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});

describe("Modal — backward compatibility", () => {
  it("accepts legacy `description` prop and renders it as subtitle", () => {
    render(
      <Modal isOpen onClose={() => null} title="t" description="legacy subtitle">
        <p>body</p>
      </Modal>,
    );
    expect(screen.getByText("legacy subtitle")).toBeTruthy();
  });
});
