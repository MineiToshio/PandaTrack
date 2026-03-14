"use server";

import { prisma } from "@/lib/prisma";
import { getIsAdmin, getSession } from "@/lib/auth/auth-server";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { getPostHogClient } from "@/lib/analytics/posthog-server";
import { createStore as createStoreQuery } from "@/queries/store";
import { createStoreSchema, type CreateStoreInput } from "../_schemas/createStoreSchema";
import type { StoreStatus } from "../../../../../../generated/prisma/client";

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
  const contactChannels = contactChannelTypes
    .map((type, i) => ({
      type,
      value: contactChannelValues[i] ?? "",
      label: contactChannelLabels[i] ?? undefined,
    }))
    .filter((ch) => ch.type.trim().length > 0);

  const addressCountryCodes = formData.getAll("addressCountryCode").filter((v): v is string => typeof v === "string");
  const addressCities = formData.getAll("addressCity").filter((v): v is string => typeof v === "string");
  const addressAddressLines = formData.getAll("addressAddressLine").filter((v): v is string => typeof v === "string");
  const addressReferences = formData.getAll("addressReference").filter((v): v is string => typeof v === "string");
  const addressIsPrimaries = formData.getAll("addressIsPrimary").filter((v): v is string => typeof v === "string");
  const addresses = addressAddressLines
    .map((addressLine, i) => ({
      countryCode: addressCountryCodes[i] ?? "",
      city: addressCities[i] || undefined,
      addressLine,
      reference: addressReferences[i] || undefined,
      isPrimary: addressIsPrimaries.includes(String(i)) ? true : undefined,
    }))
    .filter((a) => a.addressLine.trim().length > 0 && a.countryCode.length === 2);

  const raw = {
    name: formData.get("name") ?? undefined,
    description: formData.get("description") ?? undefined,
    storeType: formData.get("storeType") ?? undefined,
    countryCode: formData.get("countryCode") ?? undefined,
    presenceTypes: formData.getAll("presenceTypes").filter((v): v is string => typeof v === "string"),
    categoryKeys: formData.getAll("categoryKeys").filter((v): v is string => typeof v === "string"),
    hasStock: formData.get("hasStock") === "on" ? true : undefined,
    receivesOrders: formData.get("receivesOrders") === "on" ? true : undefined,
    contactChannels: contactChannels as { type: string; value: string; label?: string }[],
    addresses,
    importCountries: formData
      .getAll("importCountries")
      .filter((v): v is string => typeof v === "string" && v.length === 2),
  };

  const parsed = createStoreSchema.safeParse({
    name: typeof raw.name === "string" ? raw.name : "",
    description: typeof raw.description === "string" ? raw.description : undefined,
    storeType: raw.storeType,
    countryCode: typeof raw.countryCode === "string" ? raw.countryCode : "",
    presenceTypes: raw.presenceTypes,
    categoryKeys: raw.categoryKeys,
    hasStock: raw.hasStock,
    receivesOrders: raw.receivesOrders,
    contactChannels: raw.contactChannels,
    addresses: raw.addresses,
    importCountries: raw.importCountries,
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

  const allCountryCodes = [
    input.countryCode,
    ...(input.addresses?.map((a) => a.countryCode) ?? []),
    ...(input.importCountries ?? []),
  ].filter(Boolean);
  const uniqueCountryCodes = [...new Set(allCountryCodes)];

  const [countriesExist, categoriesExist] = await Promise.all([
    prisma.country.findMany({
      where: { code: { in: uniqueCountryCodes } },
      select: { code: true },
    }),
    prisma.storeCategory.findMany({
      where: { key: { in: input.categoryKeys } },
      select: { key: true },
    }),
  ]);

  const foundCountryCodes = new Set(countriesExist.map((c) => c.code));
  const missingCountry = uniqueCountryCodes.find((code) => !foundCountryCodes.has(code));
  if (missingCountry) {
    return { success: false, error: "countryInvalid", fieldErrors: { countryCode: ["countryInvalid"] } };
  }

  const foundCategoryKeys = new Set(categoriesExist.map((c) => c.key));
  const missing = input.categoryKeys.filter((k) => !foundCategoryKeys.has(k));
  if (missing.length > 0) {
    return { success: false, error: "categoryInvalid", fieldErrors: { categoryKeys: ["categoryInvalid"] } };
  }

  const isAdmin = getIsAdmin(session);
  const status: StoreStatus = isAdmin ? "APPROVED" : "PENDING";

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < SLUG_COLLISION_MAX_ATTEMPTS; attempt++) {
    try {
      const result = await createStoreQuery(prisma, {
        name: input.name,
        description: input.description ?? null,
        storeType: input.storeType,
        countryCode: input.countryCode,
        presenceTypes: input.presenceTypes,
        categoryKeys: input.categoryKeys,
        createdByUserId: session.user.id,
        status,
        approvedByUserId: isAdmin ? session.user.id : null,
        hasStock: input.hasStock ?? null,
        receivesOrders: input.receivesOrders ?? null,
        contactChannels: input.storeType === "BUSINESS" ? input.contactChannels : [],
        addresses: input.storeType === "BUSINESS" ? input.addresses : [],
        importCountries: input.importCountries?.length ? input.importCountries : undefined,
      });

      getPostHogClient().capture({
        distinctId: session.user.id,
        event: POSTHOG_EVENTS.STORE.CREATED,
        properties: {
          store_type: input.storeType,
          status,
          presence_count: input.presenceTypes.length,
          category_count: input.categoryKeys.length,
          created_by_role: isAdmin ? "admin" : "user",
        },
      });

      return {
        success: true,
        storeId: result.id,
        slug: result.slug,
        status,
      };
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      const isSlugConflict =
        typeof (e as { code?: string })?.code === "string" && (e as { code: string }).code === "P2002";
      if (!isSlugConflict) break;
    }
  }

  return {
    success: false,
    error: lastError?.message ?? "create_failed",
  };
}
