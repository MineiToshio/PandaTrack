import type {
  Prisma,
  PrismaClient,
  StoreChangeRequestStatus,
  StoreContactChannelType,
  StorePresenceType,
  StoreReportReason,
  StoreStatus,
  StoreType,
} from "../../generated/prisma/client";

export type EditableContactChannelInput = {
  type: StoreContactChannelType;
  value: string;
  label?: string | null;
};

export type EditableAddressInput = {
  city?: string | null;
  addressLine: string;
  reference?: string | null;
};

export type EditableStoreInput = {
  name: string;
  description?: string | null;
  logoUrl?: string | null;
  presenceTypes: StorePresenceType[];
  productTypeKeys: string[];
  hasStock?: boolean | null;
  receivesOrders?: boolean | null;
  isPrivate?: boolean;
  contactChannels?: EditableContactChannelInput[];
  addresses?: EditableAddressInput[];
  importCountries?: string[];
};

export type EditableStore = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  status: StoreStatus;
  storeType: StoreType;
  countryCode: string;
  createdByUserId: string;
  hasStock: boolean | null;
  receivesOrders: boolean | null;
  isPrivate: boolean;
  presenceTypes: StorePresenceType[];
  productTypeKeys: string[];
  importCountryCodes: string[];
  contactChannels: EditableContactChannelInput[];
  addresses: EditableAddressInput[];
};

export type StoreGovernanceSummary = {
  reportCounts: Array<{ reason: StoreReportReason; count: number }>;
  totalReports: number;
  openReports: number;
  changeRequestCounts: Array<{ status: StoreChangeRequestStatus; count: number }>;
  totalChangeRequests: number;
  recentChangeRequests: Array<{
    id: string;
    status: StoreChangeRequestStatus;
    updatedAt: Date;
    changedFieldKeys: string[];
  }>;
};

export type StoreGovernanceViewerContext = {
  openReport: {
    id: string;
    reason: StoreReportReason;
    details: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  openChangeRequest: {
    id: string;
    changes: EditableStoreDiff;
    comment: string | null;
    updatedAt: Date;
  } | null;
};

export type EditableStoreDiff = Partial<{
  name: string;
  description: string | null;
  logoUrl: string | null;
  presenceTypes: StorePresenceType[];
  productTypeKeys: string[];
  hasStock: boolean | null;
  receivesOrders: boolean | null;
  isPrivate: boolean;
  contactChannels: EditableContactChannelInput[];
  addresses: EditableAddressInput[];
  importCountries: string[];
}>;

const REPORT_REASONS: StoreReportReason[] = ["SPAM", "DUPLICATE", "INCORRECT_INFO", "DOES_NOT_EXIST", "INAPPROPRIATE"];
const CHANGE_REQUEST_STATUSES: StoreChangeRequestStatus[] = ["PENDING", "APPROVED", "REJECTED"];

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

function mapStoreToEditableStore(store: {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  status: StoreStatus;
  storeType: StoreType;
  countryCode: string;
  createdByUserId: string;
  hasStock: boolean | null;
  receivesOrders: boolean | null;
  isPrivate: boolean;
  presences: Array<{ presenceType: StorePresenceType }>;
  productTypeAssignments: Array<{ productTypeKey: string }>;
  importCountries: Array<{ countryCode: string }>;
  contactChannels: Array<{ type: StoreContactChannelType; value: string; label: string | null }>;
  addresses: Array<{ city: string | null; addressLine: string; reference: string | null }>;
}): EditableStore {
  return {
    id: store.id,
    slug: store.slug,
    name: store.name,
    description: store.description,
    logoUrl: store.logoUrl,
    status: store.status,
    storeType: store.storeType,
    countryCode: store.countryCode,
    createdByUserId: store.createdByUserId,
    hasStock: store.hasStock,
    receivesOrders: store.receivesOrders,
    isPrivate: store.isPrivate,
    presenceTypes: store.presences
      .map((presence) => presence.presenceType)
      .sort((left, right) => left.localeCompare(right)),
    productTypeKeys: store.productTypeAssignments
      .map((assignment) => assignment.productTypeKey)
      .sort((left, right) => left.localeCompare(right)),
    importCountryCodes: store.importCountries
      .map((country) => country.countryCode)
      .sort((left, right) => left.localeCompare(right)),
    contactChannels: store.contactChannels
      .map((channel) => ({
        type: channel.type,
        value: channel.value,
        label: channel.label,
      }))
      .sort((left, right) => {
        const typeCompare = left.type.localeCompare(right.type);
        if (typeCompare !== 0) return typeCompare;
        return left.value.localeCompare(right.value);
      }),
    addresses: store.addresses
      .map((address) => ({
        city: address.city,
        addressLine: address.addressLine,
        reference: address.reference,
      }))
      .sort((left, right) => {
        const cityCompare = (left.city ?? "").localeCompare(right.city ?? "");
        if (cityCompare !== 0) return cityCompare;
        return left.addressLine.localeCompare(right.addressLine);
      }),
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

export function mergeEditableStoreWithChangeRequest(
  store: EditableStore,
  changeRequest: EditableStoreDiff | null | undefined,
): EditableStoreInput {
  return {
    name: changeRequest?.name ?? store.name,
    description: changeRequest?.description ?? store.description,
    logoUrl: changeRequest?.logoUrl ?? store.logoUrl,
    presenceTypes: changeRequest?.presenceTypes ?? store.presenceTypes,
    productTypeKeys: changeRequest?.productTypeKeys ?? store.productTypeKeys,
    hasStock: changeRequest?.hasStock ?? store.hasStock,
    receivesOrders: changeRequest?.receivesOrders ?? store.receivesOrders,
    isPrivate: changeRequest?.isPrivate ?? store.isPrivate,
    contactChannels: changeRequest?.contactChannels ?? store.contactChannels,
    addresses: changeRequest?.addresses ?? store.addresses,
    importCountries: changeRequest?.importCountries ?? store.importCountryCodes,
  };
}

export async function getEditableStoreBySlug(db: PrismaClient, slug: string): Promise<EditableStore | null> {
  const store = await db.store.findFirst({
    where: {
      slug,
      visibility: "PUBLIC",
      status: { in: ["PENDING", "APPROVED"] },
    },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      logoUrl: true,
      status: true,
      storeType: true,
      countryCode: true,
      createdByUserId: true,
      hasStock: true,
      receivesOrders: true,
      isPrivate: true,
      presences: { select: { presenceType: true } },
      productTypeAssignments: { select: { productTypeKey: true } },
      importCountries: { select: { countryCode: true } },
      contactChannels: {
        select: {
          type: true,
          value: true,
          label: true,
        },
      },
      addresses: {
        select: {
          city: true,
          addressLine: true,
          reference: true,
        },
      },
    },
  });

  return store ? mapStoreToEditableStore(store) : null;
}

export async function getStoreGovernanceSummary(db: PrismaClient, storeId: string): Promise<StoreGovernanceSummary> {
  const [
    reportCountsRows,
    totalReports,
    openReports,
    changeRequestCountsRows,
    totalChangeRequests,
    recentChangeRequests,
  ] = await Promise.all([
    db.storeReport.groupBy({
      by: ["reason"],
      where: { storeId },
      _count: { _all: true },
    }),
    db.storeReport.count({ where: { storeId } }),
    db.storeReport.count({ where: { storeId, status: "OPEN" } }),
    db.storeChangeRequest.groupBy({
      by: ["status"],
      where: { storeId },
      _count: { _all: true },
    }),
    db.storeChangeRequest.count({ where: { storeId } }),
    db.storeChangeRequest.findMany({
      where: { storeId },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: 5,
      select: {
        id: true,
        status: true,
        changes: true,
        updatedAt: true,
      },
    }),
  ]);

  const reportCountMap = new Map(reportCountsRows.map((row) => [row.reason, row._count._all]));
  const changeRequestCountMap = new Map(changeRequestCountsRows.map((row) => [row.status, row._count._all]));

  return {
    reportCounts: REPORT_REASONS.map((reason) => ({ reason, count: reportCountMap.get(reason) ?? 0 })),
    totalReports,
    openReports,
    changeRequestCounts: CHANGE_REQUEST_STATUSES.map((status) => ({
      status,
      count: changeRequestCountMap.get(status) ?? 0,
    })),
    totalChangeRequests,
    recentChangeRequests: recentChangeRequests.map((request) => ({
      id: request.id,
      status: request.status,
      updatedAt: request.updatedAt,
      changedFieldKeys: Object.keys((request.changes as EditableStoreDiff | null) ?? {}),
    })),
  };
}

export async function getStoreGovernanceViewerContext(
  db: PrismaClient,
  storeId: string,
  userId: string,
): Promise<StoreGovernanceViewerContext> {
  const [openReport, openChangeRequest] = await Promise.all([
    db.storeReport.findFirst({
      where: {
        storeId,
        reportedById: userId,
        status: "OPEN",
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        reason: true,
        details: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    db.storeChangeRequest.findFirst({
      where: {
        storeId,
        requestedById: userId,
        status: "PENDING",
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        changes: true,
        comment: true,
        updatedAt: true,
      },
    }),
  ]);

  return {
    openReport,
    openChangeRequest: openChangeRequest
      ? {
          id: openChangeRequest.id,
          changes: (openChangeRequest.changes as EditableStoreDiff | null) ?? {},
          comment: openChangeRequest.comment,
          updatedAt: openChangeRequest.updatedAt,
        }
      : null,
  };
}

export async function upsertStoreReport(
  db: PrismaClient,
  input: {
    storeId: string;
    userId: string;
    reason: StoreReportReason;
    details?: string | null;
  },
) {
  return db.$transaction(async (tx) => {
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

export async function createStoreProductTypeRequest(
  db: PrismaClient,
  input: {
    userId: string;
    suggestedName: string;
    reason?: string | null;
  },
) {
  return db.storeProductTypeRequest.create({
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
  db: PrismaClient,
  store: EditableStore,
  input: EditableStoreInput,
): Promise<{ id: string; slug: string }> {
  const normalizedInput = normalizeEditableStoreInput(input, store.storeType);

  return db.$transaction(async (tx) => {
    const updatedStore = await tx.store.update({
      where: { id: store.id },
      data: {
        name: normalizedInput.name,
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
  db: PrismaClient,
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

  return db.$transaction(async (tx) => {
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
