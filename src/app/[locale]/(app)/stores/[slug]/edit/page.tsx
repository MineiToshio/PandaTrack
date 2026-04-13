import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { APP_SHELL_FORM_RAIL_CLASSNAME } from "@/lib/constants";
import { getIsAdmin, getSession } from "@/lib/auth/auth-server";
import { prisma } from "@/lib/prisma";
import {
  getEditableStoreBySlug,
  getStoreGovernanceViewerContext,
  mergeEditableStoreWithChangeRequest,
} from "@/queries/storeGovernance";
import EditStoreForm from "./_components/EditStoreForm";

type EditStorePageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

export default async function EditStorePage({ params }: EditStorePageProps) {
  const { locale, slug } = await params;
  const [session, store, countries, productTypes] = await Promise.all([
    getSession(),
    getEditableStoreBySlug(prisma, slug),
    prisma.country.findMany({ select: { code: true }, orderBy: { code: "asc" } }),
    prisma.storeProductType.findMany({
      where: { isActive: true },
      select: { key: true },
      orderBy: { key: "asc" },
    }),
  ]);

  if (!session?.user?.id || !store) {
    notFound();
  }

  await getTranslations({ locale, namespace: "stores" });

  const viewerContext = await getStoreGovernanceViewerContext(prisma, store.id, session.user.id);
  const isAdmin = getIsAdmin(session);
  const canDirectlyEdit = isAdmin || (store.status === "PENDING" && store.createdByUserId === session.user.id);
  const initialValues = mergeEditableStoreWithChangeRequest(store, viewerContext.openChangeRequest?.changes);

  return (
    <div className="text-foreground">
      <div className={APP_SHELL_FORM_RAIL_CLASSNAME}>
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
    </div>
  );
}
