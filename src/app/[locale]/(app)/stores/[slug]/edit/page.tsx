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

  await getTranslations({ locale, namespace: "stores" });

  const viewerContext = await getStoreGovernanceViewerContext(store.id, session.user.id);
  const isAdmin = getIsAdmin(session);
  const canDirectlyEdit = isAdmin || (store.status === "PENDING" && store.createdByUserId === session.user.id);
  const initialValues = mergeEditableStoreWithChangeRequest(store, viewerContext.openChangeRequest?.changes);

  return (
    <div className="text-foreground">
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
