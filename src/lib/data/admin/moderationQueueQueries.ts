import type {
  SellerType,
  StoreContactChannelType,
  StorePresenceType,
  StoreStatus,
} from "../../../../generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { STORE_FLAG_REPORT_THRESHOLD } from "@/lib/constants";
import { getAdminOpenStoreReports, type AdminOpenStoreReport } from "./adminStoreReportQueries";
import {
  getAdminPendingStoreChangeRequests,
  type AdminPendingStoreChangeRequest,
} from "./adminStoreChangeRequestQueries";
import {
  getAdminPendingStoreProductTypeRequests,
  type AdminPendingStoreProductTypeRequest,
} from "./adminStoreProductTypeRequestQueries";

/**
 * The five row types the moderation inbox renders. Four map to a persisted pending category; `flag`
 * is derived when a store accumulates enough open reports (see {@link STORE_FLAG_REPORT_THRESHOLD}).
 */
export const MODERATION_QUEUE_ITEM_TYPES = [
  "flag",
  "report",
  "pending_store",
  "change_request",
  "product_type",
] as const;

export type ModerationQueueItemType = (typeof MODERATION_QUEUE_ITEM_TYPES)[number];

/**
 * Impact tiers, highest first. A tier's items sort oldest-first among themselves. Encoding the order
 * here keeps the queue composition and any test in lockstep with the single ordering rule.
 */
const TIER_ORDER: ModerationQueueItemType[] = ["flag", "report", "pending_store", "change_request", "product_type"];

/**
 * Store identity plus the light metadata every store-related row shows in its header chips. The
 * `slug` lets each review invoke the slug-based FRD-04 actions and offer "Ver tienda"; `status`
 * drives the flag / unflag toggle; `sellerType` and `countryCode` render as metadata tags.
 */
export type ModerationStoreRef = {
  storeId: string;
  slug: string;
  name: string;
  status: StoreStatus;
  sellerType: SellerType;
  countryCode: string;
};

/** The store as submitted, shown in the pending-store review body. */
export type ModerationPendingStoreSummary = {
  presenceTypes: StorePresenceType[];
  productTypeKeys: string[];
  importCountryCodes: string[];
  contactChannels: Array<{ type: StoreContactChannelType; value: string; label: string | null }>;
  receivesOrders: boolean | null;
  hasStock: boolean | null;
};

/**
 * One inbox item. `id` is the value carried in `?item=<type>:<id>`: the store id for `flag` and
 * `pending_store`, the report id for `report`, the change-request id for `change_request`, and the
 * request id for `product_type`. `sortAt` is the timestamp the tier sorts by (oldest first).
 */
export type ModerationQueueItem =
  | { type: "flag"; id: string; sortAt: Date; store: ModerationStoreRef; reports: AdminOpenStoreReport[] }
  | { type: "report"; id: string; sortAt: Date; store: ModerationStoreRef; report: AdminOpenStoreReport }
  | {
      type: "pending_store";
      id: string;
      sortAt: Date;
      store: ModerationStoreRef;
      summary: ModerationPendingStoreSummary;
    }
  | {
      type: "change_request";
      id: string;
      sortAt: Date;
      store: ModerationStoreRef;
      request: AdminPendingStoreChangeRequest;
    }
  | { type: "product_type"; id: string; sortAt: Date; request: AdminPendingStoreProductTypeRequest };

/**
 * Per-category counters shown above the queue. They map to the four persisted categories; the derived
 * flag-candidate rows count inside the `stores` bucket alongside pending stores, since both are
 * store-level decisions (FDD-02 section 6.1).
 */
export type ModerationQueueCounts = {
  reports: number;
  stores: number;
  changes: number;
  types: number;
};

export type ModerationQueue = {
  items: ModerationQueueItem[];
  counts: ModerationQueueCounts;
};

/** Grouped open reports for one store, as read through the admin DAL. */
export type StoreReportsGroup = {
  store: ModerationStoreRef;
  reports: AdminOpenStoreReport[];
};

/** Pending change requests for one store, as read through the admin DAL. */
export type StoreChangeRequestsGroup = {
  store: ModerationStoreRef;
  requests: AdminPendingStoreChangeRequest[];
};

/** Pending store awaiting an approval decision, with its submitted summary. */
export type PendingStoreEntry = {
  store: ModerationStoreRef;
  summary: ModerationPendingStoreSummary;
  createdAt: Date;
};

/**
 * The pure inputs the queue is assembled from, one array per data source. Keeping this the boundary
 * lets {@link assembleModerationQueue} be unit-tested without a database: the derivation, collapse,
 * ordering, and counting are all exercised over plain fixtures.
 */
export type ModerationQueueInput = {
  pendingStores: PendingStoreEntry[];
  storeReports: StoreReportsGroup[];
  storeChangeRequests: StoreChangeRequestsGroup[];
  productTypeRequests: AdminPendingStoreProductTypeRequest[];
};

/** Earliest report timestamp in a group, used as a flag candidate's sort key. */
function earliestReportAt(reports: AdminOpenStoreReport[]): Date {
  return reports.reduce(
    (earliest, report) => (report.createdAt.getTime() < earliest.getTime() ? report.createdAt : earliest),
    reports[0].createdAt,
  );
}

/** Oldest first, breaking ties on the stable item id so ordering is deterministic. */
function byOldestFirst(left: ModerationQueueItem, right: ModerationQueueItem): number {
  const delta = left.sortAt.getTime() - right.sortAt.getTime();
  return delta !== 0 ? delta : left.id.localeCompare(right.id);
}

/**
 * Composes the four pending categories into one impact-ordered list and derives the flag-candidate
 * rows. A store with at least {@link STORE_FLAG_REPORT_THRESHOLD} open reports collapses into a single
 * `flag` row and contributes no individual `report` rows; below the threshold each open report is its
 * own `report` row. Pure over its inputs.
 */
export function assembleModerationQueue(input: ModerationQueueInput): ModerationQueue {
  const flagItems: ModerationQueueItem[] = [];
  const reportItems: ModerationQueueItem[] = [];

  for (const group of input.storeReports) {
    if (group.reports.length === 0) continue;
    if (group.reports.length >= STORE_FLAG_REPORT_THRESHOLD) {
      flagItems.push({
        type: "flag",
        id: group.store.storeId,
        sortAt: earliestReportAt(group.reports),
        store: group.store,
        reports: group.reports,
      });
      continue;
    }
    for (const report of group.reports) {
      reportItems.push({
        type: "report",
        id: report.id,
        sortAt: report.createdAt,
        store: group.store,
        report,
      });
    }
  }

  const pendingStoreItems: ModerationQueueItem[] = input.pendingStores.map((entry) => ({
    type: "pending_store",
    id: entry.store.storeId,
    sortAt: entry.createdAt,
    store: entry.store,
    summary: entry.summary,
  }));

  const changeRequestItems: ModerationQueueItem[] = input.storeChangeRequests.flatMap((group) =>
    group.requests.map((request) => ({
      type: "change_request" as const,
      id: request.id,
      sortAt: request.createdAt,
      store: group.store,
      request,
    })),
  );

  const productTypeItems: ModerationQueueItem[] = input.productTypeRequests.map((request) => ({
    type: "product_type",
    id: request.id,
    sortAt: request.createdAt,
    request,
  }));

  const byTier: Record<ModerationQueueItemType, ModerationQueueItem[]> = {
    flag: flagItems,
    report: reportItems,
    pending_store: pendingStoreItems,
    change_request: changeRequestItems,
    product_type: productTypeItems,
  };

  const items = TIER_ORDER.flatMap((tier) => [...byTier[tier]].sort(byOldestFirst));

  return {
    items,
    counts: {
      reports: reportItems.length,
      stores: pendingStoreItems.length + flagItems.length,
      changes: changeRequestItems.length,
      types: productTypeItems.length,
    },
  };
}

const STORE_REF_SELECT = {
  id: true,
  slug: true,
  name: true,
  status: true,
  sellerType: true,
  countryCode: true,
} as const;

function toStoreRef(row: {
  id: string;
  slug: string;
  name: string;
  status: StoreStatus;
  sellerType: SellerType;
  countryCode: string;
}): ModerationStoreRef {
  return {
    storeId: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    sellerType: row.sellerType,
    countryCode: row.countryCode,
  };
}

/**
 * Reads every pending category and shapes the impact-ordered moderation queue. Server-only and
 * admin-only: callers gate with `requireAdmin()` (the admin route layout) before invoking. Sensitive
 * fields (reporter identity, raw report text, requester identity) come solely from the admin DALs,
 * never the public governance read model (BR-02-03). The individual reads are batched per store and
 * the derivation runs in {@link assembleModerationQueue}, so the queue row and its review payload are
 * shaped from the same read and can never drift apart.
 */
export async function getModerationQueue(): Promise<ModerationQueue> {
  const [pendingStoreRows, reportStoreIdRows, changeRequestStoreIdRows, productTypeRequests] = await Promise.all([
    prisma.store.findMany({
      where: { status: "PENDING" },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        ...STORE_REF_SELECT,
        createdAt: true,
        receivesOrders: true,
        hasStock: true,
        presences: { select: { presenceType: true } },
        productTypeAssignments: { select: { productTypeKey: true } },
        importCountries: { select: { countryCode: true } },
        contactChannels: { select: { type: true, value: true, label: true } },
      },
    }),
    prisma.storeReport.findMany({
      where: { status: "OPEN" },
      select: { storeId: true },
      distinct: ["storeId"],
    }),
    prisma.storeChangeRequest.findMany({
      where: { status: "PENDING" },
      select: { storeId: true },
      distinct: ["storeId"],
    }),
    getAdminPendingStoreProductTypeRequests(),
  ]);

  const reportStoreIds = reportStoreIdRows.map((row) => row.storeId);
  const changeRequestStoreIds = changeRequestStoreIdRows.map((row) => row.storeId);
  const involvedStoreIds = [...new Set([...reportStoreIds, ...changeRequestStoreIds])];

  const storeRefRows = involvedStoreIds.length
    ? await prisma.store.findMany({ where: { id: { in: involvedStoreIds } }, select: STORE_REF_SELECT })
    : [];
  const storeRefById = new Map(storeRefRows.map((row) => [row.id, toStoreRef(row)]));

  const [reportsByStore, changeRequestsByStore] = await Promise.all([
    Promise.all(reportStoreIds.map((storeId) => getAdminOpenStoreReports(storeId))),
    Promise.all(changeRequestStoreIds.map((storeId) => getAdminPendingStoreChangeRequests(storeId))),
  ]);

  const storeReports: StoreReportsGroup[] = reportStoreIds.flatMap((storeId, index) => {
    const store = storeRefById.get(storeId);
    const reports = reportsByStore[index];
    return store && reports.length > 0 ? [{ store, reports }] : [];
  });

  const storeChangeRequests: StoreChangeRequestsGroup[] = changeRequestStoreIds.flatMap((storeId, index) => {
    const store = storeRefById.get(storeId);
    const requests = changeRequestsByStore[index];
    return store && requests.length > 0 ? [{ store, requests }] : [];
  });

  const pendingStores: PendingStoreEntry[] = pendingStoreRows.map((row) => ({
    store: toStoreRef(row),
    createdAt: row.createdAt,
    summary: {
      presenceTypes: row.presences.map((presence) => presence.presenceType),
      productTypeKeys: row.productTypeAssignments.map((assignment) => assignment.productTypeKey),
      importCountryCodes: row.importCountries.map((country) => country.countryCode),
      contactChannels: row.contactChannels,
      receivesOrders: row.receivesOrders,
      hasStock: row.hasStock,
    },
  }));

  return assembleModerationQueue({ pendingStores, storeReports, storeChangeRequests, productTypeRequests });
}

/**
 * Resolves the `?item=<type>:<id>` selection against a shaped queue. Returns the matching item, or the
 * first item (desktop auto-preview) when the param is absent or no longer resolves (its underlying
 * record was just acted on), or null when the queue is empty.
 */
export function resolveSelectedItem(
  items: ModerationQueueItem[],
  rawItem: string | undefined,
): ModerationQueueItem | null {
  if (items.length === 0) return null;
  if (!rawItem) return items[0];

  const separator = rawItem.indexOf(":");
  if (separator === -1) return items[0];

  const type = rawItem.slice(0, separator);
  const id = rawItem.slice(separator + 1);
  const match = items.find((item) => item.type === type && item.id === id);
  return match ?? items[0];
}
