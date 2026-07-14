import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const { captureExceptionMock } = vi.hoisted(() => ({
  captureExceptionMock: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: captureExceptionMock,
}));

import GlobalError from "../global-error";

function renderGlobalError(reset = vi.fn()) {
  const error = Object.assign(new Error("boom"), { digest: "abc123" });
  render(<GlobalError error={error} reset={reset} />);
  return { error, reset };
}

describe("GlobalError", () => {
  beforeEach(() => {
    captureExceptionMock.mockClear();
  });

  it("renders the bilingual fallback as an alert with legible Spanish and English copy", () => {
    renderGlobalError();

    const alert = screen.getByRole("alert");
    expect(alert).toBeTruthy();
    expect(screen.getByText("Algo se rompió de nuestro lado")).toBeTruthy();
    expect(screen.getByText("Something broke on our end")).toBeTruthy();
  });

  it("wires the retry action to reset()", () => {
    const { reset } = renderGlobalError();

    screen.getByRole("button").click();

    expect(reset).toHaveBeenCalledOnce();
  });

  it("captures the error exactly once with a bare captureException call", () => {
    const { error } = renderGlobalError();

    expect(captureExceptionMock).toHaveBeenCalledOnce();
    expect(captureExceptionMock).toHaveBeenCalledWith(error);
  });

  describe("lead-language guess from the URL path", () => {
    const originalPathname = window.location.pathname;

    afterEach(() => {
      window.history.replaceState({}, "", originalPathname);
    });

    it("leads with Spanish when the path has no recognized locale segment", () => {
      window.history.replaceState({}, "", "/");
      renderGlobalError();

      expect(document.documentElement.getAttribute("lang")).toBe("es");
    });

    it("leads with English when the path starts with /en", () => {
      window.history.replaceState({}, "", "/en/orders");
      renderGlobalError();

      expect(document.documentElement.getAttribute("lang")).toBe("en");
    });
  });
});
