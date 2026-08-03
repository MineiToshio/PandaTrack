import { parseImageIntakeDraft, type ImageIntakeDraft } from "./draftSchema";

/**
 * Hands the intake review screen's draft, as the collector left it, to the manual order form when
 * they choose "complete by hand" instead of saving straight from the review screen.
 *
 * sessionStorage, not a query param and not a server-side stash: the draft can carry another
 * store's product names and prices, and a URL is copied into browser history, address bars, and
 * server access logs the moment it is used for navigation. A `sessionStorage` entry never leaves
 * the browser, is invisible to the server that renders the manual form, and disappears with the
 * tab even if nothing ever reads it back. It is also never the draft's system of record: the draft
 * itself is a client-only, unsaved concept the moment it exists, and this stash is just the
 * hand-off between two screens that already share that same client, not a second place the draft
 * is kept.
 */
const MANUAL_PREFILL_STORAGE_KEY = "pandatrack:imageIntake:manualPrefill";

/**
 * How long a stashed draft stays claimable. Short on purpose: this only bridges the single
 * navigation from the review screen to the manual form, so a value measured in minutes is already
 * generous. Anything left unclaimed past it is more likely a stale entry from an abandoned tab
 * than a real hand-off still in flight, and reviving it would hand the manual form data the
 * collector never asked to see again.
 */
const MANUAL_PREFILL_TTL_MS = 15 * 60 * 1000;

type ManualPrefillEnvelope = {
  createdAt: number;
  draft: unknown;
};

function isManualPrefillEnvelope(value: unknown): value is ManualPrefillEnvelope {
  return (
    typeof value === "object" &&
    value !== null &&
    "createdAt" in value &&
    typeof (value as { createdAt: unknown }).createdAt === "number" &&
    "draft" in value
  );
}

/**
 * Stashes the confirmed draft for the manual form's next mount. Best-effort: a write that fails
 * (private browsing, storage disabled, quota exceeded) just means the manual form opens empty,
 * the same outcome as before this hand-off existed, so nothing here needs to surface as an error.
 */
export function writeManualPrefillStash(draft: ImageIntakeDraft): void {
  try {
    const envelope: ManualPrefillEnvelope = { createdAt: Date.now(), draft };
    window.sessionStorage.setItem(MANUAL_PREFILL_STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    // See above: a failed write degrades to "no prefill", never a thrown error on the review screen.
  }
}

/**
 * Reads the stash left by the review screen, if any, and removes it immediately, before the
 * validation below even runs: a second mount of the manual form (back button, a bookmark, a form
 * reset) must never resurface a hand-off that was already consumed, whether or not it turns out to
 * be valid. Nothing here is trusted: the JSON shape, its age, and the draft it carries are all
 * re-validated against the same schema the review screen's data crossed originally, so a stale
 * shape from a previous release, a tampered value, or an expired entry is silently treated as "no
 * prefill" rather than surfaced to the user or allowed to seed a malformed form.
 */
export function readAndClearManualPrefillStash(): ImageIntakeDraft | null {
  try {
    const raw = window.sessionStorage.getItem(MANUAL_PREFILL_STORAGE_KEY);
    if (raw === null) return null;
    window.sessionStorage.removeItem(MANUAL_PREFILL_STORAGE_KEY);

    const parsedEnvelope: unknown = JSON.parse(raw);
    if (!isManualPrefillEnvelope(parsedEnvelope)) return null;
    if (Date.now() - parsedEnvelope.createdAt > MANUAL_PREFILL_TTL_MS) return null;

    const result = parseImageIntakeDraft(parsedEnvelope.draft);
    return result.ok ? result.draft : null;
  } catch {
    return null;
  }
}

/** One flattened product ready to seed a manual order-form row: quantity is always 1, see below. */
export type ManualPrefillItem = {
  name: string;
  /** Minor units (×100), or `null` when the chat never priced this product individually. */
  unitPriceMinorUnits: number | null;
  /**
   * Catalog category as the collector left it on the review screen, or `null`. Carried across
   * because the manual form has this exact control: dropping it here would make "complete by hand"
   * quietly undo a category the collector had already accepted or corrected. It is safe to carry
   * because the review screen only ever holds keys the live catalog backs.
   */
  productTypeKey: string | null;
};

/** The subset of a confirmed draft the manual order form knows how to prefill. */
export type ManualFormPrefill = {
  /** Only set when the draft's matched store is one of the collector's own orderable stores. */
  storeId: string | null;
  /** ISO calendar day (`YYYY-MM-DD`), or `null` when the draft never resolved one. */
  orderDateIso: string | null;
  currencyCode: string | null;
  totalCostMinorUnits: number | null;
  items: ManualPrefillItem[];
};

/**
 * Shapes a confirmed draft into the fields the manual order form actually has controls for.
 * Everything else the draft carries (payments, delivery, per-group provenance) has no matching
 * field on that form and is silently dropped here rather than invented a place to go.
 *
 * `availableStoreIds` gates the store hand-off: the draft's `matchedStoreId` is only honoured when
 * it names a store the manual form's own `stores` prop actually lists, so a stale match against a
 * store that was archived (or belongs to a different collector's session) never gets silently
 * selected.
 */
export function deriveManualFormPrefill(
  draft: ImageIntakeDraft,
  availableStoreIds: readonly string[],
): ManualFormPrefill {
  const storeId =
    draft.store.matchedStoreId !== null && availableStoreIds.includes(draft.store.matchedStoreId)
      ? draft.store.matchedStoreId
      : null;

  // Every product in a confirmed draft already carries quantity 1: the breakdown engine expands a
  // lot phrase into one row per unit upstream, so flattening groups here needs no re-aggregation.
  const items: ManualPrefillItem[] = draft.groups.flatMap((group) =>
    group.products.map((product) => ({
      name: product.name,
      unitPriceMinorUnits: product.unitPrice,
      productTypeKey: product.suggestedProductTypeKey,
    })),
  );

  return {
    storeId,
    orderDateIso: draft.orderDate.value,
    currencyCode: draft.currency.value,
    totalCostMinorUnits: draft.totalCost.value,
    items,
  };
}
