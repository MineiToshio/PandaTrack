import { getTranslations } from "next-intl/server";
import Skeleton from "@/components/core/Skeleton";

type OrdersNewImageLoadingProps = { params?: Promise<{ locale: string }> };

/**
 * Route loading boundary while the session, the base currency, and the store list resolve. It
 * matches the upload screen's structure (heading, dropzone block, helper line, CTA) so the layout
 * does not shift when the real surface arrives.
 */
export default async function OrdersNewImageLoading({ params }: OrdersNewImageLoadingProps) {
  // `loading.tsx` does not receive params reliably in Next 15+, so `es` is the fallback.
  const resolved = params ? await params : { locale: "es" };
  const t = await getTranslations({ locale: resolved.locale, namespace: "components" });

  return (
    <div
      className="mx-auto flex w-full max-w-3xl flex-col gap-[var(--space-5)]"
      role="status"
      aria-label={t("skeleton.loading")}
    >
      <Skeleton variant="text" width="30%" />
      <Skeleton variant="rect" height={160} />
      <Skeleton variant="text" lines={2} />
      <Skeleton variant="rect" height={48} />
    </div>
  );
}
