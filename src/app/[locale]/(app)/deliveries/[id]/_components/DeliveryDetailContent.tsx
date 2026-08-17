import { getTranslations } from "next-intl/server";
import BackNavLink from "@/components/core/BackNavLink";
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
  /** The collector's civil day, resolved on the server (see the page). */
  today: Date;
};

export default async function DeliveryDetailContent({
  delivery,
  locale,
  baseCurrencyCode,
  backHref,
  today,
}: DeliveryDetailContentProps) {
  const t = await getTranslations({ locale, namespace: "deliveries" });
  const backTarget = backHref ?? `/${locale}${ROUTES.deliveries}`;

  return (
    <>
      <SetHeaderTitle title={delivery.humanReadableId} />

      <BackNavLink href={backTarget} className="mb-4">
        {t("detail.backToList")}
      </BackNavLink>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-6">
        {/* The client coordinator owns the optimistic status/receivedDate pair and renders
            both columns; the note card is server-wrapped (autosave is lifecycle-agnostic). */}
        <DeliveryDetailClient
          delivery={delivery}
          baseCurrencyCode={baseCurrencyCode}
          locale={locale}
          today={today}
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
