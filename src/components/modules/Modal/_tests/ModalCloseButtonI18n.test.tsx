import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import esCommon from "@/i18n/locales/es/common.json";
import Modal from "@/components/modules/Modal/Modal";

/**
 * The close button used to default to the hardcoded English string "Close" in `ModalContent.tsx`,
 * `ModalDialog.tsx`, and `ModalSheet.tsx` (~34 production call sites never passed
 * `closeButtonLabel`), so an `es` locale user got an English screen-reader announcement on every
 * dismissible modal. This stubs `next-intl` with the real `es/common.json` catalog, the way
 * next-intl actually resolves `useTranslations("common")("close")`, so the assertion fails for the
 * real reason (the component reads the wrong source) rather than a hand-picked fixture string.
 */
vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => {
    const catalogs: Record<string, Record<string, unknown>> = { common: esCommon };
    return (key: string) => {
      const value = catalogs[namespace]?.[key];
      return typeof value === "string" ? value : `${namespace}.${key}`;
    };
  },
}));

describe("Modal close button i18n", () => {
  it("announces the close button using the active locale's copy, not the hardcoded English default", () => {
    render(
      <Modal isOpen onClose={() => null} title="Reportar tienda">
        <p>body</p>
      </Modal>,
    );

    const closeButton = screen.getByRole("button", { name: esCommon.close });
    expect(closeButton).toBeTruthy();
    expect(closeButton.getAttribute("aria-label")).not.toBe("Close");
  });
});
