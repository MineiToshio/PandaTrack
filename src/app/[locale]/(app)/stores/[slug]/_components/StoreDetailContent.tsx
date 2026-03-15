import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import Heading from "@/components/core/Heading";
import Typography from "@/components/core/Typography";
import { ROUTES } from "@/lib/constants";
import { buttonVariants } from "@/components/core/Button/buttonVariants";
import { cn } from "@/lib/styles";
import type { StoreDetail } from "@/queries/store";

type StoreDetailContentProps = {
  locale: string;
  store: StoreDetail;
};

export default async function StoreDetailContent({ locale, store }: StoreDetailContentProps) {
  const [tStores, tCountries, tCategories, tListing] = await Promise.all([
    getTranslations({ locale, namespace: "stores" }),
    getTranslations({ locale, namespace: "countries" }),
    getTranslations({ locale, namespace: "storeCategories" }),
    getTranslations({ locale, namespace: "storeListing" }),
  ]);

  const categoryList = store.categoryKeys.map((categoryKey) => tCategories(categoryKey)).join(", ");
  const isPendingReview = store.status === "PENDING";
  const isInactive = !store.isActive;
  const isBusiness = store.storeType === "BUSINESS";

  return (
    <div className="bg-background text-foreground px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <Link
          href={`/${locale}${ROUTES.stores}`}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "inline-flex items-center gap-1")}
        >
          <ArrowLeft className="size-4" aria-hidden />
          {tListing("backToListing")}
        </Link>

        {isPendingReview && (
          <div className="border-border bg-muted/40 rounded-lg border p-4" role="note">
            <Typography size="sm" className="text-text-title font-medium">
              {tStores("detail.pendingDisclaimerTitle")}
            </Typography>
            <Typography size="sm" className="text-text-body mt-1">
              {tStores("detail.pendingDisclaimerMessage")}
            </Typography>
          </div>
        )}

        {isInactive && (
          <div className="border-border bg-muted/40 rounded-lg border p-4" role="alert">
            <Typography size="sm" className="text-text-title font-medium">
              {tStores("detail.inactiveWarningTitle")}
            </Typography>
            <Typography size="sm" className="text-text-body mt-1">
              {tStores("detail.inactiveWarningMessage")}
            </Typography>
          </div>
        )}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          {isBusiness && store.logoUrl && (
            <div className="border-border relative size-20 shrink-0 overflow-hidden rounded-lg border">
              <Image src={store.logoUrl} alt="" width={80} height={80} className="object-cover" unoptimized />
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-2">
            <Heading as="h1" size="sm" className="text-text-title">
              {store.name}
            </Heading>
            {store.description ? (
              <Typography size="sm" className="text-text-body">
                {store.description}
              </Typography>
            ) : (
              <Typography size="sm" className="text-text-muted">
                {tStores("detail.noDescription")}
              </Typography>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="border-border bg-background rounded-lg border p-4">
            <Typography size="xs" className="text-text-muted">
              {tStores("detail.countryLabel")}
            </Typography>
            <Typography size="sm" className="text-text-body mt-1">
              {tCountries(store.countryCode)}
            </Typography>
          </div>
          <div className="border-border bg-background rounded-lg border p-4">
            <Typography size="xs" className="text-text-muted">
              {tStores("detail.categoriesLabel")}
            </Typography>
            <Typography size="sm" className="text-text-body mt-1">
              {categoryList || "-"}
            </Typography>
          </div>
        </div>

        {isBusiness && store.contactChannels && store.contactChannels.length > 0 && (
          <div className="border-border bg-background rounded-lg border p-4">
            <Typography size="xs" className="text-text-muted mb-2 block font-medium">
              {tStores("create.contactChannelsLabel")}
            </Typography>
            <ul className="space-y-1" role="list">
              {store.contactChannels.map((ch) => (
                <li key={`${ch.type}-${ch.value}`}>
                  <a
                    href={ch.type === "EMAIL" ? `mailto:${ch.value}` : ch.value}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-link text-sm hover:underline"
                  >
                    {ch.label ?? tStores(`contactChannelTypes.${ch.type}`)}: {ch.value}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {isBusiness && store.addresses && store.addresses.length > 0 && (
          <div className="border-border bg-background rounded-lg border p-4">
            <Typography size="xs" className="text-text-muted mb-2 block font-medium">
              {tStores("create.addressesLabel")}
            </Typography>
            <ul className="space-y-2" role="list">
              {store.addresses.map((address, index) => (
                <li key={index} className="text-text-body text-sm">
                  {address.city && `${address.city}, `}
                  {tCountries(address.countryCode)} - {address.addressLine}
                  {address.reference && ` (${address.reference})`}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
