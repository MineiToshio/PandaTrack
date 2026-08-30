import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Modal from "@/components/modules/Modal/Modal";

vi.mock("@/hooks/useIsMobile", () => ({
  useIsMobile: vi.fn(),
}));

// ModalHeader resolves the close button's accessible name via useTranslations("common") when
// callers do not pass an explicit closeButtonLabel; these tests only care about the desktop/mobile
// variant choice, so the stub returns the key unchanged.
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

import { useIsMobile } from "@/hooks/useIsMobile";

const mockedUseIsMobile = vi.mocked(useIsMobile);

describe("Modal — adaptive variant selection", () => {
  afterEach(() => {
    mockedUseIsMobile.mockReset();
  });

  it("renders the desktop centered dialog when useIsMobile() is false", () => {
    mockedUseIsMobile.mockReturnValue(false);
    render(
      <Modal isOpen onClose={() => null} title="Desktop title">
        <p>body</p>
      </Modal>,
    );
    // ModalDialog wires aria-labelledby on its own panel — querying by role surfaces it.
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Desktop title")).toBeTruthy();
  });

  it("renders the mobile bottom sheet when useIsMobile() is true", () => {
    mockedUseIsMobile.mockReturnValue(true);
    render(
      <Modal isOpen onClose={() => null} title="Mobile title">
        <p>body</p>
      </Modal>,
    );
    // The visually-hidden Drawer.Title rendered by ModalSheet exposes the
    // same accessible name as the visible header.
    expect(screen.getAllByText("Mobile title").length).toBeGreaterThan(0);
  });
});
