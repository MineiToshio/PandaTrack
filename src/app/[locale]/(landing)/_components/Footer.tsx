"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

export default function Footer() {
  const t = useTranslations("landing.footer");
  const locale = useLocale();
  const year = new Date().getFullYear();

  return (
    <footer className="bg-background text-foreground w-full px-4 py-8 md:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
        <p className="text-muted-foreground text-sm">{t("copyright", { year })}</p>
        <nav aria-label="Legal" className="flex gap-6">
          <Link
            href={`/${locale}/terms`}
            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
          >
            {t("terms")}
          </Link>
          <Link
            href={`/${locale}/privacy`}
            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
          >
            {t("privacy")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
