import { Coins } from "lucide-react";
import { useTranslations } from "next-intl";
import Button from "@/components/core/Button/Button";
import EmptyState from "@/components/modules/EmptyState";
import { ROUTES } from "@/lib/constants";

export type ImageIntakeCurrencyGateProps = {
  locale: string;
};

/**
 * Blocks extraction until the account has a base currency.
 *
 * A source that never states a currency is the common case, and the only honest fallback is the
 * user's own base currency marked as an assumption. Without one there is nothing to assume from, so
 * asking here costs one trip to settings and asking later would cost a wrong total on a saved
 * order.
 */
export default function ImageIntakeCurrencyGate({ locale }: ImageIntakeCurrencyGateProps) {
  const t = useTranslations("imageIntake.currencyGate");

  return (
    <EmptyState
      appearance="card"
      headingAs="h2"
      icon={<Coins width={28} height={28} />}
      iconTone="warning"
      title={t("title")}
      subtitle={t("description")}
      actions={
        <div className="flex flex-wrap items-center justify-center gap-[var(--space-3)]">
          <Button as="a" href={`/${locale}${ROUTES.settings}`} variant="primary" size="md">
            {t("cta")}
          </Button>
          <Button as="a" href={`/${locale}${ROUTES.ordersNew}`} variant="ghost" size="md">
            {t("secondary")}
          </Button>
        </div>
      }
    />
  );
}
