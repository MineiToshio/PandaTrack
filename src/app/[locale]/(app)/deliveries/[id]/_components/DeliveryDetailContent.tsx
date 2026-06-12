import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ROUTES } from "@/lib/constants";
import type { DeliveryDetail } from "@/lib/data/deliveries/deliveryQueries";
import SetHeaderTitle from "@/app/[locale]/(app)/_components/AppLayout/SetHeaderTitle";
import DeliveryDetailClient from "./DeliveryDetailClient";
import DeliveryPrivateNoteCard from "./DeliveryPrivateNoteCard";

type DeliveryDetailContentProps = {
  delivery: DeliveryDetail;
  locale: string;
  baseCurrencyCode: string | null;
  backHref?: string | null;
};

export default async function DeliveryDetailContent({
  delivery,
  locale,
  baseCurrencyCode,
  backHref,
}: DeliveryDetailContentProps) {
  const t = await getTranslations({ locale, namespace: "deliveries" });
  const backTarget = backHref ?? `/${locale}${ROUTES.deliveries}`;

  return (
    <>
      <SetHeaderTitle title={delivery.humanReadableId} />

      <Link
        href={backTarget}
        className="text-text-secondary hover:text-text-title mb-4 inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        {t("detail.backToList")}
      </Link>

      <div className="lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-6">
        {/* The client coordinator owns the optimistic status/receivedDate pair and renders
            both columns; the note card is server-wrapped (autosave is lifecycle-agnostic). */}
        <DeliveryDetailClient
          delivery={delivery}
          baseCurrencyCode={baseCurrencyCode}
          locale={locale}
          noteCard={
            <DeliveryPrivateNoteCard
              deliveryId={delivery.id}
              initialNote={delivery.note}
              initialUpdatedAt={delivery.note ? delivery.updatedAt : null}
              locale={locale}
            />
          }
        />
      </div>
    </>
  );
}
