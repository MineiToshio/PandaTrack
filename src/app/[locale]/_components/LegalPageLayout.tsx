import { ArrowLeft, Calendar, ScrollText, Shield } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import PublicMinibar from "@/app/[locale]/_components/public/PublicMinibar";
import { ROUTES } from "@/lib/constants";

type LegalPageLayoutProps = {
  namespace: "terms" | "privacy";
  sectionKeys: readonly string[];
  locale: string;
};

function splitBodyIntoParagraphs(body: string): string[] {
  return body.split(/\n\n+/).filter((block) => block.trim().length > 0);
}

/**
 * Standalone legal document (`.legal-doc`): public minibar + back-link, head
 * (eyebrow + title + updated date), intro, table of contents, numbered
 * sections. Content stays verbatim from i18n (privacy.json / terms.json).
 */
export default function LegalPageLayout({ namespace, sectionKeys, locale }: LegalPageLayoutProps) {
  const t = useTranslations(namespace);
  const tLegal = useTranslations("common.legal");
  const homeHref = `/${locale}${ROUTES.home}`;
  const EyebrowIcon = namespace === "privacy" ? Shield : ScrollText;

  return (
    <div className="mk-public flex min-h-screen flex-col">
      <PublicMinibar />
      <main className="legal-doc">
        <Link href={homeHref} className="legal-back">
          <ArrowLeft aria-hidden="true" /> {tLegal("backToHome")}
        </Link>

        <div className="legal-head">
          <span className="mk-eyebrow">
            <EyebrowIcon aria-hidden="true" /> {tLegal("eyebrow")}
          </span>
          <h1>{t("title")}</h1>
          <p className="legal-updated">
            <Calendar aria-hidden="true" /> {t("lastUpdated")}
          </p>
        </div>

        <p className="legal-intro">{t("intro")}</p>

        <nav className="legal-toc" aria-label={tLegal("tableOfContents")}>
          <h4>{tLegal("tableOfContents")}</h4>
          <ol>
            {sectionKeys.map((key) => (
              <li key={key}>
                <a href={`#${key}`}>{t(`${key}Title`)}</a>
              </li>
            ))}
          </ol>
        </nav>

        {sectionKeys.map((key) => {
          const paragraphs = splitBodyIntoParagraphs(t(`${key}Body`));

          return (
            <section key={key} id={key} aria-labelledby={`${key}-heading`} className="legal-section scroll-mt-20">
              <h2 id={`${key}-heading`}>{t(`${key}Title`)}</h2>
              {paragraphs.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </section>
          );
        })}

        <Link href={homeHref} className="legal-back mt-8">
          <ArrowLeft aria-hidden="true" /> {tLegal("backToHome")}
        </Link>
      </main>
    </div>
  );
}
