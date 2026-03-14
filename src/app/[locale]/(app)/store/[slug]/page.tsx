import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Heading from "@/components/core/Heading";
import Typography from "@/components/core/Typography";
import { prisma } from "@/lib/prisma";
import { getStoreBySlug } from "@/queries/store";

type StoreDetailPageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

export default async function StoreDetailPage({ params }: StoreDetailPageProps) {
  const { locale, slug } = await params;
  const [tStores, tCountries, tCategories] = await Promise.all([
    getTranslations({ locale, namespace: "stores" }),
    getTranslations({ locale, namespace: "countries" }),
    getTranslations({ locale, namespace: "storeCategories" }),
  ]);

  const store = await getStoreBySlug(prisma, slug);

  if (!store) {
    notFound();
  }

  const categoryList = store.categoryKeys.map((categoryKey) => tCategories(categoryKey)).join(", ");
  const isPendingReview = store.status === "PENDING";

  return (
    <div className="bg-background text-foreground px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-6">
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

        <div className="space-y-2">
          <Heading as="h2" size="sm" className="text-text-title">
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
      </div>
    </div>
  );
}
