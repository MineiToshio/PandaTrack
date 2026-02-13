import Link from "next/link";
import { getTranslations } from "next-intl/server";
import Heading from "@/components/core/Heading";
import Typography from "@/components/core/Typography";
import { cn } from "@/lib/styles";

const LEGAL_BACK_LINK_CLASS =
  "text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm font-medium transition-colors";

type LegalPageLayoutProps = {
  namespace: "terms" | "privacy";
  sectionKeys: readonly string[];
  locale: string;
};

function splitBodyIntoParagraphs(body: string): string[] {
  return body.split(/\n\n+/).filter((block) => block.trim().length > 0);
}

export default async function LegalPageLayout({ namespace, sectionKeys, locale }: LegalPageLayoutProps) {
  const t = await getTranslations(namespace);
  const tLegal = await getTranslations("common.legal");

  return (
    <main className={cn("bg-background text-foreground min-h-screen px-4 py-12 md:px-6 md:py-16 lg:px-8")}>
      <div className="mx-auto max-w-3xl">
        <Link href={`/${locale}`} className={LEGAL_BACK_LINK_CLASS}>
          {tLegal("backToHome")}
        </Link>

        <header className="mt-8 mb-10">
          <Heading as="h1" size="md" className="text-text-title mb-2">
            {t("title")}
          </Heading>
          <Typography size="xs" className="text-muted-foreground" as="p">
            {t("lastUpdated")}
          </Typography>
        </header>

        <Typography size="md" className="text-text-body mb-10 leading-relaxed">
          {t("intro")}
        </Typography>

        <div className="space-y-10">
          {sectionKeys.map((key) => {
            const title = t(`${key}Title`);
            const body = t(`${key}Body`);
            const paragraphs = splitBodyIntoParagraphs(body);

            return (
              <section key={key} id={key} aria-labelledby={`${key}-heading`} className="scroll-mt-24">
                <Heading as="h2" id={`${key}-heading`} size="xs" className="text-text-title mb-3 font-semibold">
                  {title}
                </Heading>
                <div className="space-y-3">
                  {paragraphs.map((paragraph, index) => (
                    <Typography key={index} size="sm" className="text-text-body leading-relaxed" as="p">
                      {paragraph}
                    </Typography>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <footer className="border-border mt-14 border-t pt-8">
          <Link href={`/${locale}`} className={LEGAL_BACK_LINK_CLASS}>
            {tLegal("backToHome")}
          </Link>
        </footer>
      </div>
    </main>
  );
}
