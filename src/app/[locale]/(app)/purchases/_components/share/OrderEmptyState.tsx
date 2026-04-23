"use client";

import { Store } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import Typography from "@/components/core/Typography";
import { buttonVariants } from "@/components/core/Button/buttonVariants";
import { ROUTES } from "@/lib/constants";

export default function OrderEmptyState() {
  const t = useTranslations("orders.emptyState");
  const locale = useLocale();

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <span className="bg-muted text-text-muted mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full">
        <Store size={32} aria-hidden />
      </span>
      <Typography size="lg" className="text-text-title mb-2 font-semibold">
        {t("title")}
      </Typography>
      <Typography size="sm" className="text-text-muted mb-6 max-w-sm">
        {t("description")}
      </Typography>
      <Link href={`/${locale}${ROUTES.storesNew}`} className={buttonVariants({ variant: "primary" })}>
        {t("cta")}
      </Link>
    </div>
  );
}
