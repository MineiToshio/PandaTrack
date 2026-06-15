import { Mail } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { siTiktok, siWhatsapp } from "simple-icons";
import AnchorLink from "@/components/core/AnchorLink";
import BrandMark from "@/app/[locale]/_components/public/BrandMark";
import { CONTACT_INFO, POSTHOG_EVENTS, ROUTES } from "@/lib/constants";

type SocialLinkProps = {
  href: string;
  label: string;
  platform: string;
  icon: React.ReactNode;
  external?: boolean;
};

function SocialLink({ href, label, platform, icon, external }: SocialLinkProps) {
  return (
    <a
      href={href}
      aria-label={label}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      data-ph-event={POSTHOG_EVENTS.LANDING.SOCIAL_LINK_CLICKED}
      data-ph-props={JSON.stringify({ platform })}
    >
      {icon}
    </a>
  );
}

function SimpleIconSvg({ path, title }: { path: string; title: string }) {
  return (
    <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" aria-hidden="true">
      <title>{title}</title>
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

  return (
    <footer className="mk-footer">
      <div className="mk-container">
        <div className="mk-footer-top">
          <div>
            <BrandMark />
            <p className="mk-footer-tagline">{t("tagline")}</p>
          </div>
          <div className="mk-footer-cols">
            <div className="mk-footer-col">
              <h4>{t("cols.product")}</h4>
              <AnchorLink href="#user-fit">{t("links.forYou")}</AnchorLink>
              <AnchorLink href="#features">{t("links.features")}</AnchorLink>
              <AnchorLink href="#faqs">{t("links.faq")}</AnchorLink>
            </div>
            <div className="mk-footer-col">
              <h4>{t("cols.account")}</h4>
              <Link href={`/${locale}${ROUTES.signUp}`}>{t("links.signUp")}</Link>
              <Link href={`/${locale}${ROUTES.signIn}`}>{t("links.signIn")}</Link>
            </div>
            <div className="mk-footer-col">
              <h4>{t("cols.legal")}</h4>
              <Link href={`/${locale}${ROUTES.privacy}`}>{t("links.privacy")}</Link>
              <Link href={`/${locale}${ROUTES.terms}`}>{t("links.terms")}</Link>
            </div>
          </div>
        </div>
        <div className="mk-footer-bottom">
          <span className="mk-footer-copy">{t("copyright", { year })}</span>
          <div className="mk-footer-social">
            <SocialLink
              href={`mailto:${CONTACT_INFO.email}`}
              label={t("social.email")}
              platform="email"
              icon={<Mail aria-hidden="true" />}
            />
            <SocialLink
              href={CONTACT_INFO.tiktok}
              label={t("social.tiktok")}
              platform="tiktok"
              external
              icon={<SimpleIconSvg path={siTiktok.path} title="TikTok" />}
            />
            <SocialLink
              href={CONTACT_INFO.whatsapp}
              label={t("social.whatsapp")}
              platform="whatsapp"
              external
              icon={<SimpleIconSvg path={siWhatsapp.path} title="WhatsApp" />}
            />
          </div>
        </div>
      </div>
    </footer>
  );
}
