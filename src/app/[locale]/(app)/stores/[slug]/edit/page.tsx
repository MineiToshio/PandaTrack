import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getIsAdmin, getSession } from "@/lib/auth/auth-server";
import {
  getEditableStoreBySlug,
  getStoreGovernanceViewerContext,
  mergeEditableStoreWithChangeRequest,
} from "@/lib/data/stores/storeGovernanceQueries";
import { listCountryCodesCached } from "@/lib/data/catalog/countryQueries";
import { listActiveStoreProductTypeKeysCached } from "@/lib/data/catalog/storeProductTypeQueries";
import EditStoreForm from "./_components/EditStoreForm";

type EditStorePageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

export default async function EditStorePage({ params }: EditStorePageProps) {
  const { locale, slug } = await params;
  const [session, store, countries, productTypes] = await Promise.all([
    getSession(),
    getEditableStoreBySlug(slug),
    listCountryCodesCached(),
    listActiveStoreProductTypeKeysCached(),
  ]);

  if (!session?.user?.id || !store) {
    notFound();
  }

  const isAdmin = getIsAdmin(session);
  // Same rule the store detail page applies (`FR-04-33`, ADR 0009), and for the same reason: a
  // private person store belongs to its creator. This route had no such check, so any signed-in
  // user holding the slug could open the full edit form of someone else's private seller. 404
  // rather than 403 so the store's existence is not confirmed either.
  if (store.isPrivate && !isAdmin && store.createdByUserId !== session.user.id) {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: "stores" });

  const viewerContext = await getStoreGovernanceViewerContext(store.id, session.user.id);
  const canDirectlyEdit = isAdmin || (store.status === "PENDING" && store.createdByUserId === session.user.id);
  const initialValues = mergeEditableStoreWithChangeRequest(store, viewerContext.openChangeRequest?.changes);
  const pageTitle = canDirectlyEdit
    ? t("edit.direct.title", { storeName: store.name })
    : t("edit.changeRequest.title", { storeName: store.name });

  return (
    <div className="text-foreground">
      {/* The shell header shows the title as plain text; this page owns the single real h1. */}
      <h1 className="sr-only">{pageTitle}</h1>
      <EditStoreForm
        locale={locale}
        store={store}
        countries={countries}
        productTypes={productTypes}
        initialValues={initialValues}
        canDirectlyEdit={canDirectlyEdit}
        existingChangeRequest={viewerContext.openChangeRequest}
      />
    </div>
  );
}
