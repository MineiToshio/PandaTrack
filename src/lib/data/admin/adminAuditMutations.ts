import { z } from "zod";
import type { Prisma } from "../../../../generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  AUDIT_ACTION_KEYS,
  AUDIT_TARGET_TYPE_KEYS,
  type AuditAction,
  type AuditTargetType,
} from "./adminAuditVocabulary";

/**
 * Boundary schema for an audit write. `action` and `targetType` must belong to the shared stable
 * vocabularies; `reason` is an optional, non-sensitive moderator note (blank is normalized to null).
 * The trail never stores reporter identity or report free text (BR-01-04).
 */
const writeAuditEntrySchema = z.object({
  actorId: z.string().min(1),
  action: z.enum(AUDIT_ACTION_KEYS as [AuditAction, ...AuditAction[]]),
  targetType: z.enum(AUDIT_TARGET_TYPE_KEYS as [AuditTargetType, ...AuditTargetType[]]),
  targetId: z.string().min(1),
  reason: z
    .string()
    .optional()
    .nullable()
    .transform((value) => {
      const trimmed = value?.trim() ?? "";
      return trimmed.length > 0 ? trimmed : null;
    }),
});

export type WriteAuditEntryInput = {
  actorId: string;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId: string;
  reason?: string | null;
};

const AUDIT_ENTRY_SELECT = {
  id: true,
  actorId: true,
  action: true,
  targetType: true,
  targetId: true,
  reason: true,
  createdAt: true,
} satisfies Prisma.AdminAuditLogSelect;

export type AuditEntry = Prisma.AdminAuditLogGetPayload<{ select: typeof AUDIT_ENTRY_SELECT }>;

/**
 * Append a single row to the admin audit trail. Pass a Prisma transaction client (`tx`) to make the
 * audit write atomic with the privileged mutation it records, so no orphaned or missing rows are
 * possible. This module intentionally exposes no update or delete path: the log is append-only
 * (BR-01-02).
 */
export async function writeAuditEntry(input: WriteAuditEntryInput, tx?: Prisma.TransactionClient): Promise<AuditEntry> {
  const data = writeAuditEntrySchema.parse(input);
  const client = tx ?? prisma;

  return client.adminAuditLog.create({
    data: {
      actorId: data.actorId,
      action: data.action,
      targetType: data.targetType,
      targetId: data.targetId,
      reason: data.reason,
    },
    select: AUDIT_ENTRY_SELECT,
  });
}
