/**
 * Shared, stable vocabularies for the append-only admin audit trail.
 *
 * `action` and `targetType` are persisted as plain strings (not database enums) so the vocabulary
 * can grow without a migration per new key. They are validated in code against these constants at
 * the write boundary, which keeps the vocabulary stable and the trail queryable by type.
 *
 * These are consumed by the moderation console (FRD-02) and the collector app's inline moderation
 * controls (FRD-04); keep the keys stable once shipped.
 */

/** Stable action keys for privileged moderation actions. */
export const AUDIT_ACTIONS = {
  STORE_APPROVE: "store.approve",
  STORE_REMOVE: "store.remove",
  // Retired from writing: no code path emits these anymore, since the public report notice is derived
  // from open reports instead of set by hand. They stay in the vocabulary (and in the `audit.action.*`
  // i18n keys) because historical entries still carry them and the audit viewer resolves its localized
  // action title with no fallback.
  STORE_FLAG: "store.flag",
  STORE_UNFLAG: "store.unflag",
  REPORT_RESOLVE: "report.resolve",
  REPORT_DISMISS: "report.dismiss",
  CHANGE_REQUEST_APPLY: "changeRequest.apply",
  CHANGE_REQUEST_REJECT: "changeRequest.reject",
  PRODUCT_TYPE_APPROVE: "productType.approve",
  PRODUCT_TYPE_REJECT: "productType.reject",
  /** Set or cleared a collector's monthly AI-photo allowance from the override console. */
  IMAGE_INTAKE_QUOTA_OVERRIDE: "imageIntake.quotaOverride",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

/** All valid action keys, for validation and iteration. */
export const AUDIT_ACTION_KEYS = Object.values(AUDIT_ACTIONS) as readonly AuditAction[];

/** Stable target-type keys for the records a moderation action can reference. */
export const AUDIT_TARGET_TYPES = {
  STORE: "store",
  REPORT: "report",
  CHANGE_REQUEST: "changeRequest",
  PRODUCT_TYPE: "productType",
  /** A collector account, when the privileged action changes something about the account itself. */
  USER: "user",
} as const;

export type AuditTargetType = (typeof AUDIT_TARGET_TYPES)[keyof typeof AUDIT_TARGET_TYPES];

/** All valid target-type keys, for validation and iteration. */
export const AUDIT_TARGET_TYPE_KEYS = Object.values(AUDIT_TARGET_TYPES) as readonly AuditTargetType[];
