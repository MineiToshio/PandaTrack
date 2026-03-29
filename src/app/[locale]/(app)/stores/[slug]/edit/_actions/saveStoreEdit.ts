"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getIsAdmin, getSession } from "@/lib/auth/auth-server";
import { getPostHogClient } from "@/lib/analytics/posthog-server";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import {
  getEditableStoreBySlug,
  updateStoreEditableFields,
  upsertStoreChangeRequest,
  type EditableAddressInput,
  type EditableContactChannelInput,
} from "@/queries/storeGovernance";
import { editStoreSchema } from "../_schemas/editStoreSchema";

export type SaveStoreEditResult = { success: false; error: string; fieldErrors?: Record<string, string[]> };

function canDirectlyEditStore(
  store: Awaited<ReturnType<typeof getEditableStoreBySlug>>,
  userId: string,
  isAdmin: boolean,
) {
  if (!store) return false;
  if (isAdmin) return true;
  return store.status === "PENDING" && store.createdByUserId === userId;
}

export async function saveStoreEdit(
  _prev: SaveStoreEditResult | null,
  formData: FormData,
): Promise<SaveStoreEditResult> {
  const session = await getSession();
  if (!session?.user?.id) {
    return { success: false, error: "unauthorized" };
  }

  const contactChannelTypes = formData
    .getAll("contactChannelType")
    .filter((value): value is string => typeof value === "string");
  const contactChannelValues = formData
    .getAll("contactChannelValue")
    .filter((value): value is string => typeof value === "string");
  const contactChannelLabels = formData
    .getAll("contactChannelLabel")
    .filter((value): value is string => typeof value === "string");
  const contactChannels: EditableContactChannelInput[] = contactChannelTypes
    .map((type, index) => ({
      type: type as EditableContactChannelInput["type"],
      value: contactChannelValues[index] ?? "",
      label: contactChannelLabels[index] ?? undefined,
    }))
    .filter((channel) => channel.type.trim().length > 0);

  const addressCountryCodes = formData
    .getAll("addressCountryCode")
    .filter((value): value is string => typeof value === "string");
  const addressCities = formData.getAll("addressCity").filter((value): value is string => typeof value === "string");
  const addressAddressLines = formData
    .getAll("addressAddressLine")
    .filter((value): value is string => typeof value === "string");
  const addressReferences = formData
    .getAll("addressReference")
    .filter((value): value is string => typeof value === "string");
  const addresses: EditableAddressInput[] = addressAddressLines
    .map((addressLine, index) => ({
      countryCode: addressCountryCodes[index] ?? "",
      city: addressCities[index] || undefined,
      addressLine,
      reference: addressReferences[index] || undefined,
    }))
    .filter((address) => address.addressLine.trim().length > 0 && address.countryCode.length === 2);

  const parsed = editStoreSchema.safeParse({
    slug: formData.get("slug"),
    locale: formData.get("locale"),
    name: formData.get("name") ?? "",
    description: formData.get("description") ?? undefined,
    storeType: formData.get("storeType") ?? "BUSINESS",
    countryCode: formData.get("countryCode") ?? "US",
    presenceTypes: formData.getAll("presenceTypes").filter((value): value is string => typeof value === "string"),
    productTypeKeys: formData.getAll("productTypeKeys").filter((value): value is string => typeof value === "string"),
    hasStock: formData.get("hasStock") === "on" ? true : undefined,
    receivesOrders: formData.get("receivesOrders") === "on" ? true : undefined,
    contactChannels,
    addresses,
    importCountries: formData
      .getAll("importCountries")
      .filter((value): value is string => typeof value === "string" && value.length === 2),
    comment: formData.get("comment") ?? undefined,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.length > 0 ? issue.path.map(String).join(".") : "form";
      if (!fieldErrors[path]) fieldErrors[path] = [];
      fieldErrors[path].push(issue.message);
    }
    return { success: false, error: "validation_failed", fieldErrors };
  }

  const store = await getEditableStoreBySlug(prisma, parsed.data.slug);
  if (!store) {
    return { success: false, error: "storeUnavailable" };
  }

  const isAdmin = getIsAdmin(session);
  const storeDetailPath = `/${parsed.data.locale}${ROUTES.stores}/${store.slug}`;
  const storeEditPath = `${storeDetailPath}/edit`;

  try {
    if (canDirectlyEditStore(store, session.user.id, isAdmin)) {
      await updateStoreEditableFields(prisma, store, {
        name: parsed.data.name,
        description: parsed.data.description,
        presenceTypes: parsed.data.presenceTypes,
        productTypeKeys: parsed.data.productTypeKeys,
        hasStock: parsed.data.hasStock,
        receivesOrders: parsed.data.receivesOrders,
        contactChannels: parsed.data.contactChannels,
        addresses: parsed.data.addresses,
        importCountries: parsed.data.importCountries,
      });

      revalidatePath(storeDetailPath);
      revalidatePath(storeEditPath);

      redirect(storeDetailPath);
    }

    const result = await upsertStoreChangeRequest(
      prisma,
      store,
      session.user.id,
      {
        name: parsed.data.name,
        description: parsed.data.description,
        presenceTypes: parsed.data.presenceTypes,
        productTypeKeys: parsed.data.productTypeKeys,
        hasStock: parsed.data.hasStock,
        receivesOrders: parsed.data.receivesOrders,
        contactChannels: parsed.data.contactChannels,
        addresses: parsed.data.addresses,
        importCountries: parsed.data.importCountries,
      },
      parsed.data.comment,
    );

    if (result.status === "discarded") {
      getPostHogClient().capture({
        distinctId: session.user.id,
        event: POSTHOG_EVENTS.STORE.CHANGE_REQUEST_NOOP_DISCARDED,
        properties: {
          store_slug: store.slug,
          deleted_existing: result.deletedExisting,
        },
      });

      revalidatePath(storeDetailPath);
      revalidatePath(storeEditPath);

      redirect(storeDetailPath);
    }

    getPostHogClient().capture({
      distinctId: session.user.id,
      event: POSTHOG_EVENTS.STORE.CHANGE_REQUEST_SUBMITTED,
      properties: {
        store_slug: store.slug,
        changed_field_count: result.changedFieldCount,
      },
    });

    revalidatePath(storeDetailPath);
    revalidatePath(storeEditPath);

    redirect(storeDetailPath);
  } catch (error) {
    unstable_rethrow(error);
    return { success: false, error: "saveEditFailed" };
  }
}
