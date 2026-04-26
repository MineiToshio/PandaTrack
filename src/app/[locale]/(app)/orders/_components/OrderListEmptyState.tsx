import Link from "next/link";
import { ShoppingBag, SearchX } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/core/Button/buttonVariants";
import Heading from "@/components/core/Heading";
import Typography from "@/components/core/Typography";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/styles";

type OrderListEmptyStateProps = {
  locale: string;
  variant: "noOrders" | "noResults";
};

export default async function OrderListEmptyState({ locale, variant }: OrderListEmptyStateProps) {
  const t = await getTranslations({ locale, namespace: "orderListing" });
  const isNoOrders = variant === "noOrders";
  const Icon = isNoOrders ? ShoppingBag : SearchX;
  const titleKey = isNoOrders ? "empty.noOrders.title" : "empty.noResults.title";
  const descKey = isNoOrders ? "empty.noOrders.description" : "empty.noResults.description";
  const ctaKey = isNoOrders ? "empty.noOrders.cta" : "empty.noResults.cta";
  const href = isNoOrders ? `/${locale}${ROUTES.ordersNew}` : `/${locale}${ROUTES.orders}`;
  const ctaVariant = isNoOrders ? "primary" : "secondary";

  return (
    <div className="border-border/70 bg-background/70 rounded-2xl border border-dashed p-8 text-center">
      <div className="bg-primary/10 text-primary mx-auto mb-4 inline-flex size-12 items-center justify-center rounded-full">
        <Icon className="size-6" aria-hidden />
      </div>
      <Heading as="h2" size="xs" className="text-text-title">
        {t(titleKey)}
      </Heading>
      <Typography size="sm" className="text-text-muted mx-auto mt-2 max-w-md">
        {t(descKey)}
      </Typography>
      <div className="mt-5">
        <Link href={href} className={cn(buttonVariants({ variant: ctaVariant }), "min-h-11 rounded-xl px-5")}>
          {t(ctaKey)}
        </Link>
      </div>
    </div>
  );
}
