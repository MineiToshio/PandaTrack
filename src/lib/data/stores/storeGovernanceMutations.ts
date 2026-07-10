import type { Prisma, StoreReportReason, StoreType } from "../../../../generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeStoreName } from "@/lib/store/duplicateMatch";
import type { EditableStore, EditableStoreDiff, EditableStoreInput } from "./storeGovernanceQueries";

function uniqueSorted(values: string[]) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function normalizeNullableString(value?: string | null) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeEditableStoreInput(input: EditableStoreInput, storeType: StoreType): Required<EditableStoreInput> {
  const normalizedContactChannels =
    storeType === "BUSINESS"
      ? (input.contactChannels ?? [])
          .map((channel) => ({
            type: channel.type,
            value: channel.value.trim(),
            label: normalizeNullableString(channel.label),
          }))
          .filter((channel) => channel.value.length > 0)
          .sort((left, right) => {
            const typeCompare = left.type.localeCompare(right.type);
            if (typeCompare !== 0) return typeCompare;
            return left.value.localeCompare(right.value);
          })
      : [];

  const normalizedAddresses =
    storeType === "BUSINESS"
      ? (input.addresses ?? [])
          .map((address) => ({
            city: normalizeNullableString(address.city),
            addressLine: address.addressLine.trim(),
            reference: normalizeNullableString(address.reference),
          }))
          .filter((address) => address.addressLine.length > 0)
          .sort((left, right) => {
            const cityCompare = (left.city ?? "").localeCompare(right.city ?? "");
            if (cityCompare !== 0) return cityCompare;
            return left.addressLine.localeCompare(right.addressLine);
          })
      : [];

  return {
    name: input.name.trim(),
    description: normalizeNullableString(input.description),
    logoUrl: storeType === "BUSINESS" ? normalizeNullableString(input.logoUrl) : null,
    presenceTypes: [...new Set(input.presenceTypes)].sort((left, right) => left.localeCompare(right)),
    productTypeKeys: uniqueSorted(input.productTypeKeys),
    hasStock: input.hasStock ?? null,
    receivesOrders: input.receivesOrders ?? null,
    isPrivate: storeType === "PERSON" ? Boolean(input.isPrivate) : false,
    contactChannels: normalizedContactChannels,
    addresses: normalizedAddresses,
    importCountries: uniqueSorted((input.importCountries ?? []).filter((countryCode) => countryCode.length === 2)),
  };
}

function buildEditableStoreDiff(existing: EditableStore, input: Required<EditableStoreInput>): EditableStoreDiff {
  const diff: EditableStoreDiff = {};

  if (existing.name !== input.name) diff.name = input.name;
  if ((existing.description ?? null) !== input.description) diff.description = input.description;
  if ((existing.logoUrl ?? null) !== input.logoUrl) diff.logoUrl = input.logoUrl;
  if (JSON.stringify(existing.presenceTypes) !== JSON.stringify(input.presenceTypes))
    diff.presenceTypes = input.presenceTypes;
  if (JSON.stringify(existing.productTypeKeys) !== JSON.stringify(input.productTypeKeys)) {
    diff.productTypeKeys = input.productTypeKeys;
  }
  if ((existing.hasStock ?? null) !== input.hasStock) diff.hasStock = input.hasStock;
  if ((existing.receivesOrders ?? null) !== input.receivesOrders) diff.receivesOrders = input.receivesOrders;
  if (existing.isPrivate !== input.isPrivate) diff.isPrivate = input.isPrivate;
  if (JSON.stringify(existing.contactChannels) !== JSON.stringify(input.contactChannels))
    diff.contactChannels = input.contactChannels;
  if (JSON.stringify(existing.addresses) !== JSON.stringify(input.addresses)) diff.addresses = input.addresses;
  if (JSON.stringify(existing.importCountryCodes) !== JSON.stringify(input.importCountries)) {
    diff.importCountries = input.importCountries;
  }

  return diff;
}

export async function upsertStoreReport(input: {
  storeId: string;
  userId: string;
  reason: StoreReportReason;
  details?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    await tx.store.findUniqueOrThrow({
      where: { id: input.storeId },
      select: { id: true },
    });

    const existingOpenReport = await tx.storeReport.findFirst({
      where: {
        storeId: input.storeId,
        reportedById: input.userId,
        status: "OPEN",
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      select: { id: true },
    });

    const report = existingOpenReport
      ? await tx.storeReport.update({
          where: { id: existingOpenReport.id },
          data: {
            reason: input.reason,
            details: normalizeNullableString(input.details),
          },
          select: {
            id: true,
            reason: true,
            details: true,
            status: true,
            updatedAt: true,
          },
        })
      : await tx.storeReport.create({
          data: {
            storeId: input.storeId,
            reportedById: input.userId,
            reason: input.reason,
            details: normalizeNullableString(input.details),
          },
          select: {
            id: true,
            reason: true,
            details: true,
            status: true,
            updatedAt: true,
          },
        });

    return report;
  });
}

export async function createStoreProductTypeRequest(input: {
  userId: string;
  suggestedName: string;
  reason?: string | null;
}) {
  return prisma.storeProductTypeRequest.create({
    data: {
      requestedById: input.userId,
      suggestedName: input.suggestedName.trim(),
      reason: normalizeNullableString(input.reason),
    },
    select: {
      id: true,
      suggestedName: true,
      reason: true,
      status: true,
      createdAt: true,
    },
  });
}

export async function updateStoreEditableFields(
  store: EditableStore,
  input: EditableStoreInput,
): Promise<{ id: string; slug: string }> {
  const normalizedInput = normalizeEditableStoreInput(input, store.storeType);

  return prisma.$transaction(async (tx) => {
    const updatedStore = await tx.store.update({
      where: { id: store.id },
      data: {
        name: normalizedInput.name,
        searchName: normalizeStoreName(normalizedInput.name),
        description: normalizedInput.description,
        logoUrl: normalizedInput.logoUrl,
        hasStock: normalizedInput.hasStock,
        receivesOrders: normalizedInput.receivesOrders,
        isPrivate: normalizedInput.isPrivate,
      },
      select: { id: true, slug: true },
    });

    await Promise.all([
      tx.storePresence.deleteMany({ where: { storeId: store.id } }),
      tx.storeProductTypeAssignment.deleteMany({ where: { storeId: store.id } }),
      tx.storeImportCountry.deleteMany({ where: { storeId: store.id } }),
      tx.storeContactChannel.deleteMany({ where: { storeId: store.id } }),
      tx.storeAddress.deleteMany({ where: { storeId: store.id } }),
    ]);

    await Promise.all([
      ...(normalizedInput.presenceTypes.length > 0
        ? [
            tx.storePresence.createMany({
              data: normalizedInput.presenceTypes.map((presenceType) => ({
                storeId: store.id,
                presenceType,
              })),
            }),
          ]
        : []),
      ...(normalizedInput.productTypeKeys.length > 0
        ? [
            tx.storeProductTypeAssignment.createMany({
              data: normalizedInput.productTypeKeys.map((productTypeKey) => ({
                storeId: store.id,
                productTypeKey,
              })),
            }),
          ]
        : []),
      ...(normalizedInput.importCountries.length > 0
        ? [
            tx.storeImportCountry.createMany({
              data: normalizedInput.importCountries.map((countryCode) => ({
                storeId: store.id,
                countryCode,
              })),
            }),
          ]
        : []),
      ...(normalizedInput.contactChannels.length > 0
        ? [
            tx.storeContactChannel.createMany({
              data: normalizedInput.contactChannels.map((channel) => ({
                storeId: store.id,
                type: channel.type,
                value: channel.value,
                label: channel.label ?? null,
                isPrimary: false,
              })),
            }),
          ]
        : []),
      ...(normalizedInput.addresses.length > 0
        ? [
            tx.storeAddress.createMany({
              data: normalizedInput.addresses.map((address, index) => ({
                storeId: store.id,
                city: address.city ?? null,
                addressLine: address.addressLine,
                reference: address.reference ?? null,
                isPrimary: index === 0,
              })),
            }),
          ]
        : []),
    ]);

    return updatedStore;
  });
}

export async function upsertStoreChangeRequest(
  store: EditableStore,
  userId: string,
  input: EditableStoreInput,
  comment?: string | null,
): Promise<
  | { status: "saved"; changeRequestId: string; changedFieldCount: number }
  | { status: "discarded"; deletedExisting: boolean }
> {
  const normalizedInput = normalizeEditableStoreInput(input, store.storeType);
  const diff = buildEditableStoreDiff(store, normalizedInput);
  const commentValue = normalizeNullableString(comment);

  return prisma.$transaction(async (tx) => {
    const existingOpenRequest = await tx.storeChangeRequest.findFirst({
      where: {
        storeId: store.id,
        requestedById: userId,
        status: "PENDING",
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      select: { id: true },
    });

    const hasChanges = Object.keys(diff).length > 0;

    if (!hasChanges) {
      if (existingOpenRequest) {
        await tx.storeChangeRequest.delete({
          where: { id: existingOpenRequest.id },
        });
      }

      return {
        status: "discarded" as const,
        deletedExisting: existingOpenRequest != null,
      };
    }

    const changeRequest = existingOpenRequest
      ? await tx.storeChangeRequest.update({
          where: { id: existingOpenRequest.id },
          data: {
            changes: diff as Prisma.InputJsonValue,
            comment: commentValue,
          },
          select: { id: true },
        })
      : await tx.storeChangeRequest.create({
          data: {
            storeId: store.id,
            requestedById: userId,
            changes: diff as Prisma.InputJsonValue,
            comment: commentValue,
          },
          select: { id: true },
        });

    return {
      status: "saved" as const,
      changeRequestId: changeRequest.id,
      changedFieldCount: Object.keys(diff).length,
    };
  });
}
