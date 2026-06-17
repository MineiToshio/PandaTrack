import { Clock } from "lucide-react";
import { getTranslations } from "next-intl/server";

type OrderOverdueBannerProps = {
  overdueDays: number;
  expectedDeliveryToLabel: string;
  locale: string;
};

export default async function OrderOverdueBanner({
  overdueDays,
  expectedDeliveryToLabel,
  locale,
}: OrderOverdueBannerProps) {
  const t = await getTranslations({ locale, namespace: "orders" });
  const title =
    overdueDays === 1 ? t("detail.overdueBanner.titleOne") : t("detail.overdueBanner.title", { days: overdueDays });
  const subtitle = t("detail.overdueBanner.subtitle", { date: expectedDeliveryToLabel });

  return (
    <div
      role="alert"
      className="mb-4 flex items-center gap-2.5 rounded-xl border p-3"
      style={{
        background: "color-mix(in oklch, var(--warning) 10%, var(--surface))",
        borderColor: "color-mix(in oklch, var(--warning) 35%, transparent)",
      }}
    >
      <Clock className="text-warning size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 text-sm leading-snug">
        <span className="text-warning font-semibold">{title}</span>
        <span className="text-text-secondary ml-1.5">· {subtitle}</span>
      </div>
    </div>
  );
}
