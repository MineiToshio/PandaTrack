"use server";

import * as Sentry from "@sentry/nextjs";
import { getIsAdmin, getSession } from "@/lib/auth/auth-server";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { getPostHogClient } from "@/lib/analytics/posthog-server";
import { createStore as createStoreQuery, deleteStoreById, updateStoreLogoUrl } from "@/lib/data/stores/storeMutations";
import { listExistingCountryCodes } from "@/lib/data/catalog/countryQueries";
import { listExistingStoreProductTypeKeys } from "@/lib/data/catalog/storeProductTypeQueries";
import { getStoreLogoObjectKey, processStoreLogoFile, StoreLogoError } from "@/lib/store/logo";
import { deleteStoreLogoObject, uploadStoreLogoBuffer } from "@/lib/store/logoStorage";
import { normalizeContactChannelsForCountry } from "@/lib/store/contactChannelValue";
import { createStoreSchema, type CreateStoreInput } from "../_schemas/createStoreSchema";
import type { StoreStatus } from "../../../../../../../generated/prisma/client";

const SLUG_COLLISION_MAX_ATTEMPTS = 5;

export type CreateStoreResult =
  | { success: true; storeId: string; slug: string; status: StoreStatus }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

export async function createStore(prev: CreateStoreResult | null, formData: FormData): Promise<CreateStoreResult> {
  const session = await getSession();
  if (!session?.user?.id) {
    return { success: false, error: "unauthorized" };
  }

  const contactChannelTypes = formData.getAll("contactChannelType").filter((v): v is string => typeof v === "string");
  const contactChannelValues = formData.getAll("contactChannelValue").filter((v): v is string => typeof v === "string");
  const contactChannelLabels = formData.getAll("contactChannelLabel").filter((v): v is string => typeof v === "string");
  const rawCountryCode = formData.get("countryCode");
  const contactChannels = normalizeContactChannelsForCountry(
    contactChannelTypes
      .map((type, i) => ({
        type,
        value: contactChannelValues[i] ?? "",
        label: contactChannelLabels[i] ?? undefined,
      }))
      .filter((ch) => ch.type.trim().length > 0),
    typeof rawCountryCode === "string" ? rawCountryCode : null,
  );

  const addressCities = formData.getAll("addressCity").filter((v): v is string => typeof v === "string");
  const addressAddressLines = formData.getAll("addressAddressLine").filter((v): v is string => typeof v === "string");
  const addressReferences = formData.getAll("addressReference").filter((v): v is string => typeof v === "string");
  const addressIsPrimaries = formData.getAll("addressIsPrimary").filter((v): v is string => typeof v === "string");
  const addresses = addressAddressLines
    .map((addressLine, i) => ({
      city: addressCities[i] || undefined,
      addressLine,
      reference: addressReferences[i] || undefined,
      isPrimary: addressIsPrimaries.includes(String(i)) ? true : undefined,
    }))
    .filter((a) => a.addressLine.trim().length > 0);

  const raw = {
    name: formData.get("name") ?? undefined,
    description: formData.get("description") ?? undefined,
    sellerType: formData.get("sellerType") ?? undefined,
    countryCode: formData.get("countryCode") ?? undefined,
    presenceTypes: formData.getAll("presenceTypes").filter((v): v is string => typeof v === "string"),
    productTypeKeys: formData.getAll("productTypeKeys").filter((v): v is string => typeof v === "string"),
    hasStock: formData.get("hasStock") === "on" ? true : undefined,
    receivesOrders: formData.get("receivesOrders") === "on" ? true : undefined,
    isPrivate: formData.get("isPrivate") === "on" ? true : undefined,
    contactChannels: contactChannels as { type: string; value: string; label?: string }[],
    addresses,
    importCountries: formData
      .getAll("importCountries")
      .filter((v): v is string => typeof v === "string" && v.length === 2),
    logoAction: formData.get("logoAction") ?? "keep",
  };
  const logoFileValue = formData.get("logoFile");
  const logoFile = logoFileValue instanceof File && logoFileValue.size > 0 ? logoFileValue : null;

  const parsed = createStoreSchema.safeParse({
    name: typeof raw.name === "string" ? raw.name : "",
    description: typeof raw.description === "string" ? raw.description : undefined,
    sellerType: raw.sellerType,
    countryCode: typeof raw.countryCode === "string" ? raw.countryCode : "",
    presenceTypes: raw.presenceTypes,
    productTypeKeys: raw.productTypeKeys,
    hasStock: raw.hasStock,
    receivesOrders: raw.receivesOrders,
    isPrivate: raw.isPrivate,
    contactChannels: raw.contactChannels,
    addresses: raw.addresses,
    importCountries: raw.importCountries,
    logoAction: raw.logoAction,
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

  const input = parsed.data as CreateStoreInput;
  // RETAILER and PROXY sellers expose a logo; PERSON sellers do not.
  const exposesContactInfo = input.sellerType !== "PERSON";
  // A PROXY is an intermediary with no catalog of its own.
  const isProxy = input.sellerType === "PROXY";
  const isBusinessLogoSet = exposesContactInfo && input.logoAction === "set";
  if (isBusinessLogoSet && !logoFile) {
    return {
      success: false,
      error: "validation_failed",
      fieldErrors: { logo: ["logoRequired"] },
    };
  }

  const allCountryCodes = [input.countryCode, ...(input.importCountries ?? [])].filter(Boolean);
  const uniqueCountryCodes = [...new Set(allCountryCodes)];

  const [countriesExist, productTypesExist] = await Promise.all([
    listExistingCountryCodes(uniqueCountryCodes),
    listExistingStoreProductTypeKeys(input.productTypeKeys),
  ]);

  const foundCountryCodes = new Set(countriesExist.map((c) => c.code));
  const missingCountry = uniqueCountryCodes.find((code) => !foundCountryCodes.has(code));
  if (missingCountry) {
    return { success: false, error: "countryInvalid", fieldErrors: { countryCode: ["countryInvalid"] } };
  }

  const foundProductTypeKeys = new Set(productTypesExist.map((productType) => productType.key));
  const missing = input.productTypeKeys.filter((key) => !foundProductTypeKeys.has(key));
  if (missing.length > 0) {
    return {
      success: false,
      error: "validation_failed",
      fieldErrors: { productTypeKeys: ["productTypeInvalid"] },
    };
  }

  const isAdmin = getIsAdmin(session);
  const status: StoreStatus = isAdmin ? "APPROVED" : "PENDING";
  const posthogClient = getPostHogClient();

  let processedLogoBuffer: Buffer | null = null;
  if (isBusinessLogoSet && logoFile) {
    try {
      processedLogoBuffer = await processStoreLogoFile(logoFile);
    } catch (error) {
      const errorCode = error instanceof StoreLogoError ? error.code : "logoProcessingFailed";

      posthogClient.capture({
        distinctId: session.user.id,
        event: POSTHOG_EVENTS.STORE.LOGO_UPLOAD_FAILED,
        properties: {
          flow: "create",
          stage: "processing",
          seller_type: input.sellerType,
          error_code: errorCode,
        },
      });

      if (!(error instanceof StoreLogoError)) {
        Sentry.withScope((scope) => {
          scope.setTag("feature", "store_logo");
          scope.setTag("action", "create_store");
          scope.setTag("severity", "high");
          scope.setContext("storeLogo", {
            flow: "create",
            sellerType: input.sellerType,
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

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < SLUG_COLLISION_MAX_ATTEMPTS; attempt++) {
    let createdStore: { id: string; slug: string } | null = null;
    // Tracks whether the R2 object actually exists, distinct from `processedLogoBuffer` (which
    // only says a logo was PREPARED). Set the instant the upload call resolves, so the compensation
    // path below knows whether there is an object to clean up or the failure happened before one
    // was ever written.
    let logoUploaded = false;
    try {
      createdStore = await createStoreQuery({
        name: input.name,
        description: input.description ?? null,
        sellerType: input.sellerType,
        countryCode: input.countryCode,
        presenceTypes: input.presenceTypes,
        // A PROXY has no catalog: it saves with no categories, stock, or pre-order signal.
        productTypeKeys: isProxy ? [] : input.productTypeKeys,
        createdByUserId: session.user.id,
        status,
        approvedByUserId: isAdmin ? session.user.id : null,
        hasStock: isProxy ? null : (input.hasStock ?? null),
        receivesOrders: isProxy ? null : (input.receivesOrders ?? null),
        isPrivate: input.sellerType === "PERSON" ? Boolean(input.isPrivate) : false,
        contactChannels: exposesContactInfo ? input.contactChannels : [],
        addresses: exposesContactInfo ? input.addresses : [],
        importCountries: input.importCountries?.length ? input.importCountries : undefined,
        logoUrl: null,
      });

      if (processedLogoBuffer) {
        posthogClient.capture({
          distinctId: session.user.id,
          event: POSTHOG_EVENTS.STORE.LOGO_UPLOAD_STARTED,
          properties: {
            flow: "create",
            stage: "upload",
            seller_type: input.sellerType,
          },
        });

        const logoUrl = await uploadStoreLogoBuffer(getStoreLogoObjectKey(createdStore.id), processedLogoBuffer);
        logoUploaded = true;

        await updateStoreLogoUrl(createdStore.id, logoUrl);

        posthogClient.capture({
          distinctId: session.user.id,
          event: POSTHOG_EVENTS.STORE.LOGO_UPLOAD_SUCCEEDED,
          properties: {
            flow: "create",
            store_id: createdStore.id,
          },
        });
      }

      posthogClient.capture({
        distinctId: session.user.id,
        event: POSTHOG_EVENTS.STORE.CREATED,
        properties: {
          seller_type: input.sellerType,
          status,
          presence_count: input.presenceTypes.length,
          product_type_count: input.productTypeKeys.length,
          created_by_role: isAdmin ? "admin" : "user",
        },
      });

      return {
        success: true,
        storeId: createdStore.id,
        slug: createdStore.slug,
        status,
      };
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      const isSlugConflict =
        typeof (e as { code?: string })?.code === "string" && (e as { code: string }).code === "P2002";

      if (createdStore && processedLogoBuffer && !isSlugConflict) {
        const storeId = createdStore.id;

        if (logoUploaded) {
          await deleteStoreLogoObject(getStoreLogoObjectKey(storeId)).catch((cleanupError) => {
            Sentry.withScope((scope) => {
              scope.setTag("feature", "store_logo");
              scope.setTag("action", "create_store_compensation");
              scope.setTag("severity", "high");
              scope.setContext("storeLogo", { flow: "create", storeId, sellerType: input.sellerType });
              Sentry.captureException(cleanupError);
            });
          });
        }

        await deleteStoreById(storeId).catch((cleanupError) => {
          Sentry.withScope((scope) => {
            scope.setTag("feature", "store_logo");
            scope.setTag("action", "create_store_compensation");
            scope.setTag("severity", "high");
            scope.setContext("storeLogo", { flow: "create", storeId, sellerType: input.sellerType });
            Sentry.captureException(cleanupError);
          });
        });
      }

      if (processedLogoBuffer && !isSlugConflict) {
        posthogClient.capture({
          distinctId: session.user.id,
          event: POSTHOG_EVENTS.STORE.LOGO_UPLOAD_FAILED,
          properties: {
            flow: "create",
            stage: "upload",
            seller_type: input.sellerType,
            error_code: "logoUploadFailed",
          },
        });

        Sentry.withScope((scope) => {
          scope.setTag("feature", "store_logo");
          scope.setTag("action", "create_store");
          scope.setTag("severity", "high");
          scope.setContext("storeLogo", {
            flow: "create",
            sellerType: input.sellerType,
          });
          Sentry.captureException(e);
        });

        return {
          success: false,
          error: "logoUploadFailed",
          fieldErrors: {
            logo: ["logoUploadFailed"],
          },
        };
      }

      if (!isSlugConflict) break;
    }
  }

  return {
    success: false,
    error: lastError?.message ?? "create_failed",
  };
}
