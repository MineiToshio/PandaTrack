"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/core/Button/Button";
import { buttonVariants } from "@/components/core/Button/buttonVariants";
import Typography from "@/components/core/Typography";
import { POSTHOG_EVENTS, REFERRAL_QUERY_KEY, REFERRAL_VALUE_WAITLIST } from "@/lib/constants";
import { cn } from "@/lib/styles";
import { Link2, Share2 } from "lucide-react";
import { siFacebook, siWhatsapp, siX } from "simple-icons";

const SHARE_BUTTON_CLASS = "min-w-[140px] gap-2 focus-visible:ring-primary";

const COPY_FEEDBACK_DURATION_MS = 2000;

const ICON_SIZE = 20;

function SimpleIconSvg({ path, size = ICON_SIZE }: { path: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className="shrink-0" aria-hidden>
      <path d={path} />
    </svg>
  );
}

export default function WaitlistShare({ locale }: { locale: string }) {
  const t = useTranslations("landing.waitlist.share");
  const [shareUrl, setShareUrl] = useState("");
  const [hasNativeShare, setHasNativeShare] = useState(false);
  const [copiedFeedbackShown, setCopiedFeedbackShown] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const basePath = locale ? `/${locale}` : "";
    const url = `${window.location.origin}${basePath}?${REFERRAL_QUERY_KEY}=${REFERRAL_VALUE_WAITLIST}`;
    const hasShare = !!navigator.share;
    queueMicrotask(() => {
      setShareUrl(url);
      setHasNativeShare(hasShare);
    });
  }, [locale]);

  const shareMessageWithUrl = shareUrl ? `${t("shareMessage")} ${shareUrl}` : "";

  const handleNativeShare = useCallback(() => {
    if (!shareUrl || !navigator.share) return;
    const shareData: ShareData = {
      title: "PandaTrack",
      text: shareMessageWithUrl,
      url: shareUrl,
    };
    navigator.share(shareData).catch(() => {});
  }, [shareUrl, shareMessageWithUrl]);

  const handleCopyLink = useCallback(() => {
    if (!shareUrl) return;
    setCopyFailed(false);
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard
        .writeText(shareUrl)
        .then(() => {
          setCopiedFeedbackShown(true);
          setTimeout(() => setCopiedFeedbackShown(false), COPY_FEEDBACK_DURATION_MS);
        })
        .catch(() => setCopyFailed(true));
    } else {
      setCopyFailed(true);
    }
  }, [shareUrl]);

  const shareLinkItems: Array<{ href: string; iconPath: string; labelKey: string }> = [
    {
      href: shareUrl && shareMessageWithUrl ? `https://wa.me/?text=${encodeURIComponent(shareMessageWithUrl)}` : "#",
      iconPath: siWhatsapp.path,
      labelKey: "whatsapp",
    },
    {
      href:
        shareUrl && shareMessageWithUrl
          ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareMessageWithUrl)}`
          : "#",
      iconPath: siX.path,
      labelKey: "x",
    },
    {
      href: shareUrl ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}` : "#",
      iconPath: siFacebook.path,
      labelKey: "facebook",
    },
  ];

  const linkClassName = cn(buttonVariants({ variant: "outline", size: "lg" }), SHARE_BUTTON_CLASS);

  return (
    <div
      className="border-border bg-card mt-10 rounded-2xl border p-8 text-center"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <Typography className="text-foreground font-medium">{t("heading")}</Typography>
      <Typography size="sm" className="text-text-muted mt-2">
        {t("subtext")}
      </Typography>

      <div className="border-border mt-6 border-t pt-6">
        <div className="flex flex-wrap items-center justify-center gap-3">
          {shareLinkItems.map((item) => (
            <a
              key={item.labelKey}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className={linkClassName}
              aria-label={t(item.labelKey as "whatsapp" | "x" | "facebook")}
              data-ph-event={POSTHOG_EVENTS.LANDING.WAITLIST.SHARE_LINK_CLICKED}
              data-ph-props={JSON.stringify({ platform: item.labelKey })}
            >
              <SimpleIconSvg path={item.iconPath} />
              <span>{t(item.labelKey as "whatsapp" | "x" | "facebook")}</span>
            </a>
          ))}
          {hasNativeShare && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handleNativeShare}
              className={cn(SHARE_BUTTON_CLASS)}
              aria-label={t("shareButton")}
              posthogEvent={POSTHOG_EVENTS.LANDING.WAITLIST.SHARE_NATIVE_CLICKED}
            >
              <Share2 className="size-5 shrink-0" aria-hidden />
              <span>{t("shareButton")}</span>
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={handleCopyLink}
            className={cn(SHARE_BUTTON_CLASS)}
            aria-label={t("copyLinkButton")}
            aria-live="polite"
            aria-atomic
            posthogEvent={POSTHOG_EVENTS.LANDING.WAITLIST.SHARE_COPY_LINK_CLICKED}
          >
            <Link2 className="size-5 shrink-0" aria-hidden />
            <span>
              {copiedFeedbackShown ? <span className="font-medium">{t("copiedFeedback")}</span> : t("copyLinkButton")}
            </span>
          </Button>
        </div>

        {copyFailed && shareUrl && (
          <div className="mt-4">
            <Typography size="sm" className="text-text-muted mb-2">
              {t("copyFallbackLabel")}
            </Typography>
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="border-border bg-background text-foreground focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
              aria-label={t("copyFallbackLabel")}
              onFocus={(e) => e.target.select()}
            />
          </div>
        )}
      </div>
    </div>
  );
}
