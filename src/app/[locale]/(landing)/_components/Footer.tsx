import { Mail } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { siTiktok, siWhatsapp } from "simple-icons";
import { CONTACT_INFO, POSTHOG_EVENTS } from "@/lib/constants";

const ICON_SIZE = 18;
const FOCUS_VISIBLE_CLASS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-md";

type SocialLinkProps = {
  href: string;
  ariaLabel: string;
  platform: string;
  icon: React.ReactNode;
};

function SocialLink({ href, ariaLabel, platform, icon }: SocialLinkProps) {
  return (
    <a
      href={href}
      className={`hover:text-foreground inline-flex items-center gap-1.5 transition-colors ${FOCUS_VISIBLE_CLASS}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ariaLabel}
      data-ph-event={POSTHOG_EVENTS.LANDING.SOCIAL_LINK_CLICKED}
      data-ph-props={JSON.stringify({ platform })}
    >
      {icon}
    </a>
  );
}

function SimpleIconSvg({ path }: { path: string }) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      width={ICON_SIZE}
      height={ICON_SIZE}
      fill="currentColor"
      aria-hidden
    >
      <path d={path} />
    </svg>
  );
}

type FooterProps = {
  locale: string;
};

export default function Footer({ locale }: FooterProps) {
  const t = useTranslations("landing.footer");
  const year = new Date().getFullYear();
  const focusVisibleClass = FOCUS_VISIBLE_CLASS;

  return (
    <footer className="bg-background text-foreground w-full px-4 py-8 md:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row sm:items-start">
        <div className="text-muted-foreground flex flex-col items-center gap-1 text-center text-sm sm:items-start sm:text-left">
          <p>{t("copyright", { year })}</p>
          <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 sm:justify-start">
            <span>{t("madeBy")}</span>
            <SocialLink
              href={`mailto:${CONTACT_INFO.email}`}
              ariaLabel={CONTACT_INFO.email}
              platform="email"
              icon={<Mail size={ICON_SIZE} aria-hidden />}
            />
            <SocialLink
              href={CONTACT_INFO.tiktok}
              ariaLabel={`TikTok ${CONTACT_INFO.tiktok}`}
              platform="tiktok"
              icon={<SimpleIconSvg path={siTiktok.path} />}
            />
            <SocialLink
              href={CONTACT_INFO.whatsapp}
              ariaLabel={`WhatsApp ${CONTACT_INFO.whatsapp}`}
              platform="whatsapp"
              icon={<SimpleIconSvg path={siWhatsapp.path} />}
            />
          </p>
        </div>
        <nav aria-label="Legal" className="flex gap-6">
          <Link
            href={`/${locale}/terms`}
            className={`text-muted-foreground hover:text-foreground text-sm transition-colors ${focusVisibleClass}`}
          >
            {t("terms")}
          </Link>
          <Link
            href={`/${locale}/privacy`}
            className={`text-muted-foreground hover:text-foreground text-sm transition-colors ${focusVisibleClass}`}
          >
            {t("privacy")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
