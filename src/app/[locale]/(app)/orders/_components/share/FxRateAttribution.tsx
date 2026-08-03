import { useTranslations } from "next-intl";
import { cn } from "@/lib/styles";

/** The credit link the rate provider's terms require wherever one of its rates is shown. */
const EXCHANGE_RATE_API_URL = "https://www.exchangerate-api.com";

export type FxRateAttributionProps = {
  className?: string;
};

/**
 * One discreet line crediting the exchange-rate provider.
 *
 * It exists as a component rather than as four copies of the same markup because the credit is a
 * contractual obligation attached to the rate itself: every surface that shows an automatically
 * fetched rate has to carry it, and a shared component is what keeps a new surface from forgetting.
 */
export default function FxRateAttribution({ className }: FxRateAttributionProps) {
  const t = useTranslations("orders.fx");

  return (
    <p className={cn("[font-size:var(--text-caption)] [color:var(--text-muted)]", className)}>
      {t.rich("attribution", {
        link: (chunks) => (
          <a
            href={EXCHANGE_RATE_API_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-sm underline underline-offset-2 hover:[color:var(--text-secondary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:[outline-color:var(--accent)]"
          >
            {chunks}
          </a>
        ),
      })}
    </p>
  );
}
