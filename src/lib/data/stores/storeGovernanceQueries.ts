import type {
  StoreChangeRequestStatus,
  StoreContactChannelType,
  StorePresenceType,
  StoreReportReason,
  StoreStatus,
  StoreType,
} from "../../../../generated/prisma/client";
import { prisma } from "@/lib/prisma";

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
  /** Operational state. `false` marks the store as closed / no longer operating. Defaults to active. */
  isActive?: boolean;
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
  isActive: boolean;
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
  isActive: boolean;
  contactChannels: EditableContactChannelInput[];
  addresses: EditableAddressInput[];
  importCountries: string[];
}>;

const REPORT_REASONS: StoreReportReason[] = ["SPAM", "DUPLICATE", "INCORRECT_INFO", "DOES_NOT_EXIST", "INAPPROPRIATE"];
const CHANGE_REQUEST_STATUSES: StoreChangeRequestStatus[] = ["PENDING", "APPROVED", "REJECTED"];

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
  isActive: boolean;
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
    isActive: store.isActive,
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
    isActive: changeRequest?.isActive ?? store.isActive,
    contactChannels: changeRequest?.contactChannels ?? store.contactChannels,
    addresses: changeRequest?.addresses ?? store.addresses,
    importCountries: changeRequest?.importCountries ?? store.importCountryCodes,
  };
}

export async function getEditableStoreBySlug(slug: string): Promise<EditableStore | null> {
  const store = await prisma.store.findFirst({
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
      isActive: true,
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

export async function getStoreGovernanceSummary(storeId: string): Promise<StoreGovernanceSummary> {
  const [
    reportCountsRows,
    totalReports,
    openReports,
    changeRequestCountsRows,
    totalChangeRequests,
    recentChangeRequests,
  ] = await Promise.all([
    prisma.storeReport.groupBy({
      by: ["reason"],
      where: { storeId },
      _count: { _all: true },
    }),
    prisma.storeReport.count({ where: { storeId } }),
    prisma.storeReport.count({ where: { storeId, status: "OPEN" } }),
    prisma.storeChangeRequest.groupBy({
      by: ["status"],
      where: { storeId },
      _count: { _all: true },
    }),
    prisma.storeChangeRequest.count({ where: { storeId } }),
    prisma.storeChangeRequest.findMany({
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
  storeId: string,
  userId: string,
): Promise<StoreGovernanceViewerContext> {
  const [openReport, openChangeRequest] = await Promise.all([
    prisma.storeReport.findFirst({
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
    prisma.storeChangeRequest.findFirst({
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
