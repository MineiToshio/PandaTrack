import type { Prisma } from "../../../../generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { AuditAction, AuditTargetType } from "./adminAuditVocabulary";

/** Default page size for the audit viewer listing. */
export const DEFAULT_AUDIT_LOG_PAGE_SIZE = 25;

/** Upper bound so a caller cannot request an unbounded page. */
const MAX_AUDIT_LOG_PAGE_SIZE = 100;

const AUDIT_ENTRY_SELECT = {
  id: true,
  actorId: true,
  action: true,
  targetType: true,
  targetId: true,
  reason: true,
  createdAt: true,
  // Joined so the viewer renders the acting admin without a second read. The relation is
  // `onDelete: Restrict`, so the actor always exists; `username` is shown, `name` is the tooltip.
  actor: { select: { username: true, name: true } },
} satisfies Prisma.AdminAuditLogSelect;

export type AuditLogEntry = Prisma.AdminAuditLogGetPayload<{ select: typeof AUDIT_ENTRY_SELECT }>;

export type AuditLogListFilters = {
  /** Restrict to actions taken by a single admin. */
  actorId?: string;
  /** Restrict to a single target type (paired with `targetId` to trace one record's history). */
  targetType?: AuditTargetType;
  targetId?: string;
  action?: AuditAction;
  /** 1-based page index. Values below 1 are clamped to 1. */
  page?: number;
  /** Page size, clamped between 1 and `MAX_AUDIT_LOG_PAGE_SIZE`. */
  pageSize?: number;
};

export type AuditLogPage = {
  items: AuditLogEntry[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
};

function buildAuditLogWhere(filters: AuditLogListFilters): Prisma.AdminAuditLogWhereInput {
  const where: Prisma.AdminAuditLogWhereInput = {};
  if (filters.actorId) where.actorId = filters.actorId;
  if (filters.targetType) where.targetType = filters.targetType;
  if (filters.targetId) where.targetId = filters.targetId;
  if (filters.action) where.action = filters.action;
  return where;
}

/**
 * List audit entries newest first, with basic offset pagination. Consumed by the future audit
 * viewer (FRD-02, WO-03); the composite `[targetType, targetId]` and `[createdAt]` indexes back the
 * filter-by-target and order-by-time paths.
 */
export async function listAuditEntries(filters: AuditLogListFilters = {}): Promise<AuditLogPage> {
  const requestedPage = filters.page && Number.isInteger(filters.page) && filters.page > 0 ? filters.page : 1;
  const requestedPageSize =
    filters.pageSize && Number.isInteger(filters.pageSize) && filters.pageSize > 0
      ? Math.min(filters.pageSize, MAX_AUDIT_LOG_PAGE_SIZE)
      : DEFAULT_AUDIT_LOG_PAGE_SIZE;
  const where = buildAuditLogWhere(filters);

  const totalCount = await prisma.adminAuditLog.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalCount / requestedPageSize));
  const currentPage = Math.min(requestedPage, totalPages);
  const skip = (currentPage - 1) * requestedPageSize;

  const items = await prisma.adminAuditLog.findMany({
    where,
    select: AUDIT_ENTRY_SELECT,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip,
    take: requestedPageSize,
  });

  return {
    items,
    totalCount,
    currentPage,
    pageSize: requestedPageSize,
    totalPages,
  };
}
