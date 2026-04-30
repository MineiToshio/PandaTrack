import Link from "next/link";
import { PackageOpen } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { buttonVariants } from "@/components/core/Button/buttonVariants";
import Typography from "@/components/core/Typography";
import AppPageHero from "@/components/modules/AppPageHero";
import { APP_SHELL_FORM_RAIL_CLASSNAME, ROUTES } from "@/lib/constants";

export default function DeliveryCreateEmptyState() {
  const t = useTranslations("deliveries");
  const locale = useLocale();

  return (
    <div className={`${APP_SHELL_FORM_RAIL_CLASSNAME} space-y-6`}>
      <AppPageHero eyebrow={t("create.heroEyebrow")} title={t("empty.title")} description={t("empty.description")} />
      <div className="border-border bg-card flex flex-col items-start gap-4 rounded-2xl border p-5 shadow-sm">
        <PackageOpen className="text-primary size-8" aria-hidden />
        <Typography size="sm" className="text-text-body">
          {t("empty.body")}
        </Typography>
        <Link href={`/${locale}${ROUTES.ordersNew}`} className={buttonVariants({ variant: "primary", size: "md" })}>
          {t("empty.cta")}
        </Link>
      </div>
    </div>
  );
}
