import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import posthog from "posthog-js";
import Waitlist from "@/app/[locale]/(landing)/_components/Waitlist/Waitlist";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { describe, expect, it, vi } from "vitest";

const { useActionStateMock } = vi.hoisted(() => ({
  useActionStateMock: vi.fn(),
}));

const translationMap = {
  title: "Join the waitlist",
  subtitle: "Track your collectibles from purchase to delivery.",
  cta: "Join now",
  error: "Something went wrong. Please try again.",
  "fields.email": "Email",
  "fields.emailPlaceholder": "collector@example.com",
  "fields.name": "Name",
  "fields.nameOptional": "optional",
  "fields.namePlaceholder": "Your name",
  "fields.comment": "Comment",
  "fields.commentOptional": "optional",
  "fields.commentPlaceholder": "What do you collect?",
  emailRequired: "Email is required",
  emailInvalid: "Enter a valid email",
} as const;

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();

  return {
    ...actual,
    useActionState: useActionStateMock,
  };
});

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: (namespace: string) => (key: keyof typeof translationMap) => {
    if (namespace === "landing.waitlist" || namespace === "landing.waitlist.validation") {
      return translationMap[key];
    }

    return key;
  },
}));

vi.mock("posthog-js", () => ({
  default: {
    capture: vi.fn(),
  },
}));

vi.mock("@/app/[locale]/(landing)/_components/Waitlist/WaitlistForm", () => ({
  default: ({
    onSubmit,
    emailError,
    showError,
  }: {
    onSubmit: (formData: FormData) => void;
    emailError?: string;
    showError: boolean;
  }) => {
    const invalidFormData = new FormData();
    invalidFormData.set("email", "   ");

    const validFormData = new FormData();
    validFormData.set("email", "collector@example.com");
    validFormData.set("name", "Sergio");
    validFormData.set("comment", "Tracking pre-orders");

    return (
      <div>
        <button type="button" onClick={() => onSubmit(invalidFormData)}>
          Trigger invalid submit
        </button>
        <button type="button" onClick={() => onSubmit(validFormData)}>
          Trigger valid submit
        </button>
        {emailError ? <div role="alert">{emailError}</div> : null}
        {showError ? <div role="alert">{translationMap.error}</div> : null}
      </div>
    );
  },
}));

vi.mock("@/app/[locale]/(landing)/_components/Waitlist/WaitlistShare", () => ({
  default: ({ locale }: { locale: string }) => <div>Share state for {locale}</div>,
}));

describe("Waitlist", () => {
  it("shows a translated client validation error and blocks submission for invalid email", async () => {
    const user = userEvent.setup();
    const formAction = vi.fn();
    useActionStateMock.mockReturnValue([null, formAction, false]);

    render(<Waitlist />);

    await user.click(screen.getByRole("button", { name: "Trigger invalid submit" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(translationMap.emailInvalid);
    expect(posthog.capture).not.toHaveBeenCalled();
    expect(formAction).not.toHaveBeenCalled();
  });

  it("submits valid form data through the action contract and tracks waitlist submission", async () => {
    const user = userEvent.setup();
    const formAction = vi.fn();
    useActionStateMock.mockReturnValue([null, formAction, false]);

    render(<Waitlist />);

    await user.click(screen.getByRole("button", { name: "Trigger valid submit" }));

    expect(posthog.capture).toHaveBeenCalledWith(POSTHOG_EVENTS.LANDING.WAITLIST.SUBMITTED, {
      locale: "en",
      has_name: true,
      has_comment: true,
    });
    expect(formAction).toHaveBeenCalledTimes(1);

    const submittedFormData = formAction.mock.calls[0][0];
    expect(submittedFormData).toBeInstanceOf(FormData);
    expect(submittedFormData.get("email")).toBe("collector@example.com");
    expect(submittedFormData.get("name")).toBe("Sergio");
    expect(submittedFormData.get("comment")).toBe("Tracking pre-orders");
  });

  it("renders the share state once the server action reports success", () => {
    useActionStateMock.mockReturnValue([{ success: true }, vi.fn(), false]);

    render(<Waitlist />);

    expect(screen.getByText("Share state for en")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: translationMap.cta })).not.toBeInTheDocument();
  });

  it("shows the translated generic error when the server action fails", () => {
    useActionStateMock.mockReturnValue([{ success: false, error: "submitError" }, vi.fn(), false]);

    render(<Waitlist />);

    expect(screen.getByRole("alert")).toHaveTextContent(translationMap.error);
  });
});
