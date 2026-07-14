"use server";

import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { getIsAdmin, getSession } from "@/lib/auth/auth-server";
import { getPostHogClient } from "@/lib/analytics/posthog-server";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import {
  getPendingStoreLogoObjectKey,
  getStoreLogoObjectKey,
  processStoreLogoFile,
  StoreLogoError,
} from "@/lib/store/logo";
import { deleteStoreLogoObject, uploadStoreLogoBuffer } from "@/lib/store/logoStorage";
import {
  getEditableStoreBySlug,
  getStoreGovernanceViewerContext,
  type EditableAddressInput,
  type EditableContactChannelInput,
} from "@/lib/data/stores/storeGovernanceQueries";
import { updateStoreEditableFields, upsertStoreChangeRequest } from "@/lib/data/stores/storeGovernanceMutations";
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

  const addressCities = formData.getAll("addressCity").filter((value): value is string => typeof value === "string");
  const addressAddressLines = formData
    .getAll("addressAddressLine")
    .filter((value): value is string => typeof value === "string");
  const addressReferences = formData
    .getAll("addressReference")
    .filter((value): value is string => typeof value === "string");
  const addresses: EditableAddressInput[] = addressAddressLines
    .map((addressLine, index) => ({
      city: addressCities[index] || undefined,
      addressLine,
      reference: addressReferences[index] || undefined,
    }))
    .filter((address) => address.addressLine.trim().length > 0);
  const logoFileValue = formData.get("logoFile");
  const logoFile = logoFileValue instanceof File && logoFileValue.size > 0 ? logoFileValue : null;

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
    isPrivate: formData.get("isPrivate") === "on" ? true : undefined,
    contactChannels,
    addresses,
    importCountries: formData
      .getAll("importCountries")
      .filter((value): value is string => typeof value === "string" && value.length === 2),
    logoAction: formData.get("logoAction") ?? "keep",
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

  const store = await getEditableStoreBySlug(parsed.data.slug);
  if (!store) {
    return { success: false, error: "storeUnavailable" };
  }

  const isAdmin = getIsAdmin(session);
  const viewerContext = await getStoreGovernanceViewerContext(store.id, session.user.id);
  const storeDetailPath = `/${parsed.data.locale}${ROUTES.stores}/${store.slug}`;
  const storeEditPath = `${storeDetailPath}/edit`;
  const canDirectEdit = canDirectlyEditStore(store, session.user.id, isAdmin);
  const currentLogoUrl = viewerContext.openChangeRequest?.changes.logoUrl ?? store.logoUrl;
  const isBusinessLogoSet = store.storeType === "BUSINESS" && parsed.data.logoAction === "set";

  if (isBusinessLogoSet && !logoFile) {
    return {
      success: false,
      error: "validation_failed",
      fieldErrors: { logo: ["logoRequired"] },
    };
  }

  const posthogClient = getPostHogClient();
  let nextLogoUrl = currentLogoUrl;

  if (store.storeType === "BUSINESS") {
    if (parsed.data.logoAction === "remove") {
      nextLogoUrl = null;
    }

    if (isBusinessLogoSet && logoFile) {
      try {
        posthogClient.capture({
          distinctId: session.user.id,
          event: POSTHOG_EVENTS.STORE.LOGO_UPLOAD_STARTED,
          properties: {
            flow: "edit",
            mode: canDirectEdit ? "direct" : "change_request",
            store_slug: store.slug,
          },
        });

        const processedLogoBuffer = await processStoreLogoFile(logoFile);
        const objectKey = canDirectEdit
          ? getStoreLogoObjectKey(store.id)
          : getPendingStoreLogoObjectKey(store.id, session.user.id);

        nextLogoUrl = await uploadStoreLogoBuffer(objectKey, processedLogoBuffer);

        posthogClient.capture({
          distinctId: session.user.id,
          event: POSTHOG_EVENTS.STORE.LOGO_UPLOAD_SUCCEEDED,
          properties: {
            flow: "edit",
            mode: canDirectEdit ? "direct" : "change_request",
            store_slug: store.slug,
          },
        });
      } catch (error) {
        const errorCode = error instanceof StoreLogoError ? error.code : "logoUploadFailed";

        posthogClient.capture({
          distinctId: session.user.id,
          event: POSTHOG_EVENTS.STORE.LOGO_UPLOAD_FAILED,
          properties: {
            flow: "edit",
            mode: canDirectEdit ? "direct" : "change_request",
            store_slug: store.slug,
            error_code: errorCode,
          },
        });

        if (!(error instanceof StoreLogoError)) {
          Sentry.withScope((scope) => {
            scope.setTag("feature", "store_logo");
            scope.setTag("action", "save_store_edit");
            scope.setTag("severity", "high");
            scope.setContext("storeLogo", {
              flow: "edit",
              mode: canDirectEdit ? "direct" : "change_request",
              storeSlug: store.slug,
              sourceMimeType: logoFile.type,
              sourceSizeBytes: logoFile.size,
            });
            Sentry.captureException(error);
          });
        }

        return {
          success: false,
          error: errorCode,
          fieldErrors: {
            logo: [errorCode],
          },
        };
      }
    }
  } else {
    nextLogoUrl = null;
  }

  try {
    if (canDirectEdit) {
      await updateStoreEditableFields(store, {
        name: parsed.data.name,
        description: parsed.data.description,
        logoUrl: nextLogoUrl,
        presenceTypes: parsed.data.presenceTypes,
        productTypeKeys: parsed.data.productTypeKeys,
        hasStock: parsed.data.hasStock,
        receivesOrders: parsed.data.receivesOrders,
        isPrivate: parsed.data.isPrivate,
        contactChannels: parsed.data.contactChannels,
        addresses: parsed.data.addresses,
        importCountries: parsed.data.importCountries,
      });

      if (parsed.data.logoAction === "remove" && store.logoUrl) {
        await deleteStoreLogoObject(getStoreLogoObjectKey(store.id)).catch((error) => {
          Sentry.withScope((scope) => {
            scope.setTag("feature", "store_logo");
            scope.setTag("action", "delete_store_logo");
            scope.setTag("severity", "medium");
            scope.setContext("storeLogo", {
              flow: "edit",
              mode: "direct",
              storeSlug: store.slug,
            });
            Sentry.captureException(error);
          });
        });
      }

      revalidatePath(storeDetailPath);
      revalidatePath(storeEditPath);

      redirect(storeDetailPath);
    }

    const result = await upsertStoreChangeRequest(
      store,
      session.user.id,
      {
        name: parsed.data.name,
        description: parsed.data.description,
        logoUrl: nextLogoUrl,
        presenceTypes: parsed.data.presenceTypes,
        productTypeKeys: parsed.data.productTypeKeys,
        hasStock: parsed.data.hasStock,
        receivesOrders: parsed.data.receivesOrders,
        isPrivate: parsed.data.isPrivate,
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
    Sentry.captureException(error);
    return { success: false, error: "saveEditFailed" };
  }
}
