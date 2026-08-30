import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import StoreProductTypeRequestModal from "../StoreProductTypeRequestModal";

const { saveStoreProductTypeRequestMock, addToastMock, captureMock } = vi.hoisted(() => ({
  saveStoreProductTypeRequestMock: vi.fn(),
  addToastMock: vi.fn(),
  captureMock: vi.fn(),
}));

vi.mock("../../../_actions/saveStoreProductTypeRequest", () => ({
  saveStoreProductTypeRequest: saveStoreProductTypeRequestMock,
}));

vi.mock("@/contexts/ToastContext", () => ({ useToast: () => ({ addToast: addToastMock }) }));

vi.mock("posthog-js", () => ({ default: { capture: captureMock } }));

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const translate = (key: string) => key;
    // `translateError` probes `t.has(...)` before falling back to the generic validation copy.
    translate.has = () => true;
    return translate;
  },
}));

type MockModalAction = { label: string; onClick: () => void; disabled?: boolean };

// Mirrors the pattern used by `OrderCancelModal.test.tsx`: stub the canonical `<Modal>` shell so
// the test exercises this component's own submit contract without the adaptive dialog machinery.
vi.mock("@/components/modules/Modal/Modal", () => ({
  default: ({
    isOpen,
    children,
    primaryAction,
    secondaryAction,
  }: {
    isOpen: boolean;
    children: ReactNode;
    primaryAction: MockModalAction;
    secondaryAction: MockModalAction;
  }) =>
    isOpen ? (
      <div>
        {children}
        <button type="button" onClick={primaryAction.onClick} disabled={primaryAction.disabled}>
          {primaryAction.label}
        </button>
        <button type="button" onClick={secondaryAction.onClick} disabled={secondaryAction.disabled}>
          {secondaryAction.label}
        </button>
      </div>
    ) : null,
}));

/** A promise the test can resolve on demand, to observe state before the server responds. */
function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

async function openModalAndFillName(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "governance.productTypeRequest.openCta" }));
  const nameInput = document.getElementById("product-type-request-name-create") as HTMLInputElement;
  await user.type(nameInput, "Trading cards");
  return nameInput;
}

describe("StoreProductTypeRequestModal submit contract", () => {
  beforeEach(() => {
    saveStoreProductTypeRequestMock.mockReset();
    addToastMock.mockReset();
    captureMock.mockReset();
  });

  it("closes the modal synchronously on submit, before the server action resolves", async () => {
    const user = userEvent.setup();
    const deferred = createDeferred<{ success: true }>();
    saveStoreProductTypeRequestMock.mockReturnValue(deferred.promise);

    render(<StoreProductTypeRequestModal locale="en" source="create" />);
    await openModalAndFillName(user);

    await user.click(screen.getByRole("button", { name: "governance.productTypeRequest.submitCta" }));

    // The modal must be gone immediately, while the action is still in flight.
    expect(screen.queryByRole("button", { name: "governance.productTypeRequest.submitCta" })).not.toBeInTheDocument();
    expect(saveStoreProductTypeRequestMock).toHaveBeenCalledTimes(1);

    deferred.resolve({ success: true });
    await waitFor(() => expect(addToastMock).toHaveBeenCalled());
  });

  it("surfaces the server failure as an error toast instead of an inline field error", async () => {
    const user = userEvent.setup();
    saveStoreProductTypeRequestMock.mockResolvedValue({
      success: false,
      error: "saveProductTypeRequestFailed",
    });

    render(<StoreProductTypeRequestModal locale="en" source="create" />);
    await openModalAndFillName(user);
    await user.click(screen.getByRole("button", { name: "governance.productTypeRequest.submitCta" }));

    await waitFor(() =>
      expect(addToastMock).toHaveBeenCalledWith("governance.productTypeRequest.errors.saveProductTypeRequestFailed", {
        variant: "error",
      }),
    );
    // No inline field error should be rendered anywhere (the modal is gone and the error is a toast).
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a success toast when the server confirms the request", async () => {
    const user = userEvent.setup();
    saveStoreProductTypeRequestMock.mockResolvedValue({ success: true });

    render(<StoreProductTypeRequestModal locale="en" source="create" />);
    await openModalAndFillName(user);
    await user.click(screen.getByRole("button", { name: "governance.productTypeRequest.submitCta" }));

    await waitFor(() =>
      expect(addToastMock).toHaveBeenCalledWith("governance.productTypeRequest.success", { variant: "success" }),
    );
  });
});
