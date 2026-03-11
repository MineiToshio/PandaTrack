import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WaitlistShare from "@/app/[locale]/(landing)/_components/Waitlist/WaitlistShare";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const translationMap = {
  heading: "You're on the list.",
  subtext: "Know another collector? Share PandaTrack and help us launch sooner.",
  shareMessage:
    "I'm on the PandaTrack waitlist — an app to organize purchases, shipping, and pre-orders for collectibles in one place. Join here:",
  shareButton: "Share",
  copyLinkButton: "Copy link",
  copiedFeedback: "Copied!",
  copyFallbackLabel: "Copy the link manually",
  whatsapp: "WhatsApp",
  x: "X (Twitter)",
  facebook: "Facebook",
} as const;

vi.mock("next-intl", () => ({
  useTranslations: () => (key: keyof typeof translationMap) => translationMap[key],
}));

describe("WaitlistShare", () => {
  const originalLocation = window.location;
  const originalShare = navigator.share;
  const originalClipboard = navigator.clipboard;
  const secureContextDescriptor = Object.getOwnPropertyDescriptor(window, "isSecureContext");
  let nativeShareMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    nativeShareMock = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(window, "location", {
      configurable: true,
      value: new URL("https://pandatrack.test/en"),
    });

    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: false,
    });

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });

    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: nativeShareMock,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });

    if (secureContextDescriptor) {
      Object.defineProperty(window, "isSecureContext", secureContextDescriptor);
    } else {
      Reflect.deleteProperty(window, "isSecureContext");
    }

    if (originalClipboard) {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: originalClipboard,
      });
    } else {
      Reflect.deleteProperty(navigator, "clipboard");
    }

    if (originalShare) {
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: originalShare,
      });
    } else {
      Reflect.deleteProperty(navigator, "share");
    }
  });

  it("renders share links with PandaTrack referral metadata and supports share fallbacks", async () => {
    const user = userEvent.setup();

    render(<WaitlistShare locale="en" />);

    const whatsappLink = await screen.findByRole("link", { name: translationMap.whatsapp });
    const copyButton = screen.getByRole("button", { name: translationMap.copyLinkButton });
    const nativeShareButton = screen.getByRole("button", { name: translationMap.shareButton });

    const shareUrl = "https://pandatrack.test/en?ref=waitlist";

    await waitFor(() => {
      expect(whatsappLink).toHaveAttribute(
        "href",
        `https://wa.me/?text=${encodeURIComponent(`${translationMap.shareMessage} ${shareUrl}`)}`,
      );
    });
    expect(whatsappLink).toHaveAttribute("data-ph-event", POSTHOG_EVENTS.LANDING.WAITLIST.SHARE_LINK_CLICKED);
    expect(nativeShareButton).toHaveAttribute("data-ph-event", POSTHOG_EVENTS.LANDING.WAITLIST.SHARE_NATIVE_CLICKED);

    await user.click(nativeShareButton);
    expect(nativeShareMock).toHaveBeenCalledWith({
      title: "PandaTrack",
      text: `${translationMap.shareMessage} ${shareUrl}`,
      url: shareUrl,
    });

    await user.click(copyButton);

    await waitFor(() => {
      expect(screen.getByLabelText(translationMap.copyFallbackLabel)).toHaveValue(shareUrl);
    });
  });
});
