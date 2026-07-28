/**
 * Pure mapping from stable audit vocabulary keys to their `admin` namespace translation keys.
 * Action keys are dotted (`store.remove`), which collides with next-intl's nested-key notation, so
 * they are flattened to underscores (`store_remove`) for lookup. The functions stay presentation
 * agnostic (they return keys, not translated text) so they can be unit tested without i18n.
 *
 * Inputs are typed as `string` because `AdminAuditLog.action` / `targetType` are persisted as plain
 * strings (see `adminAuditVocabulary.ts`); callers pass a value from that stable vocabulary.
 */

/** Translation key for the localized label of a target type, e.g. `audit.targetType.store`. */
export function auditTargetTypeLabelKey(targetType: string): string {
  return `audit.targetType.${targetType}`;
}

/** Translation key for the localized title describing an action key, e.g. `audit.action.store_remove`. */
export function auditActionTitleKey(action: string): string {
  return `audit.action.${action.replace(/\./g, "_")}`;
}
