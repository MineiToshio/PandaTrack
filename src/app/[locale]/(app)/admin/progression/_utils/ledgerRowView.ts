/**
 * Pure mapping from stored progression vocabulary to `admin` namespace translation keys.
 *
 * The functions return keys, never translated text, so they stay unit-testable without i18n and the
 * whole dynamic-key surface of this route sits in one reviewable place. This mirrors
 * `audit/_utils/auditRowView.ts`, which does the same job for the audit vocabulary.
 *
 * Inputs are typed as `string` because `PointLedgerEntry.ruleKey` / `entityType` are persisted as
 * plain strings; callers pass a value from the `pointRules.ts` catalogue. A key the catalogue never
 * defined resolves to nothing, which is why the table renders the raw stored value and uses the
 * translation only as a tooltip.
 */

/** Translation key for a rule's human label, e.g. `progression.rules.order_created`. */
export function pointRuleLabelKey(ruleKey: string): string {
  return `progression.rules.${ruleKey.replace(/-/g, "_")}`;
}

/** Translation key for an entity type's label, e.g. `progression.entityTypes.order`. */
export function progressionEntityTypeLabelKey(entityType: string): string {
  return `progression.entityTypes.${entityType}`;
}

/** Translation key for a ledger source's label, e.g. `progression.sources.LIVE`. */
export function pointLedgerSourceLabelKey(source: string): string {
  return `progression.sources.${source}`;
}
