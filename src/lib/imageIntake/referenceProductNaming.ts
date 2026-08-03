/**
 * Which extracted products the collector could still name better by attaching a screenshot of the
 * product's own page.
 *
 * Pure and free of React on purpose: the review screen only renders the answer, and the rule itself
 * ("this name is really just the link's host") is the kind of string comparison that has to be
 * exercised directly rather than through a rendered card.
 */

import type { ExtractedGroup } from "./draftSchema";

/**
 * Strips everything that makes two spellings of the same host look different: the scheme, a `www.`
 * prefix, a trailing slash, surrounding space, and letter case. Hosts are case-insensitive, and the
 * `www.` prefix is dropped because the review screen already labels a link by its bare host, so that
 * is the form the collector sees and the form a fallback name is likely to carry.
 */
function normalizeHostLike(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
}

/**
 * Host of a captured link, without the noise a full URL would put in a product row or a sentence.
 * Shared by every surface that names a link, so the review screen and the group card cannot drift
 * into labelling the same address two different ways.
 */
export function formatReferenceHost(referenceUrl: string): string {
  try {
    return new URL(referenceUrl).host.replace(/^www\./, "");
  } catch {
    // Unreachable in practice: the draft contract only accepts a parseable http(s) URL. Falling
    // back to the raw value keeps a render from crashing if that ever stops being true.
    return referenceUrl;
  }
}

/**
 * True when a product's name is nothing more than the host of its own link.
 *
 * This is the one weak name the extraction deliberately produces: when a buyer pastes a link with no
 * text at all, the model is told to use the host so the row stays identifiable. Detecting it means
 * comparing the name against the host rather than pattern-matching for something that looks like a
 * domain, because a real product can legitimately be called "Nintendo Switch 2" and a store can
 * legitimately be called "mercadolibre".
 */
export function isHostOnlyProductName(name: string, referenceUrl: string): boolean {
  const normalizedName = normalizeHostLike(name);
  if (normalizedName === "") return false;

  let host: string;
  try {
    host = new URL(referenceUrl).host;
  } catch {
    // Unreachable through the draft contract, which only accepts a parseable http(s) URL. A name
    // cannot be judged weak against an address that cannot be read, so it is left alone.
    return false;
  }

  return normalizedName === normalizeHostLike(host);
}

/** Why the review screen is asking for this product's page, which decides the wording it uses. */
export type ReferenceNamingReason = "host-only-name" | "doubtful-group";

/** One product whose naming a screenshot of its own page would improve. */
export type ProductNeedingReferenceSheet = {
  /** Index into `draft.groups`, so the caller can point at the card that holds the row. */
  groupIndex: number;
  /** Index into that group's `products`. */
  productIndex: number;
  name: string;
  referenceUrl: string;
  reason: ReferenceNamingReason;
};

/**
 * Every product that carries a captured link and whose name is still weak.
 *
 * Two shapes of weakness count, and only these two: the name is the link's host (nothing in the
 * image named the product), or the group came back doubtful (something was read, but the extraction
 * itself says not to trust it). A product with a link and a confident name needs nothing: the link
 * is then extra evidence, not a gap.
 */
export function findProductsNeedingReferenceSheet(groups: readonly ExtractedGroup[]): ProductNeedingReferenceSheet[] {
  const found: ProductNeedingReferenceSheet[] = [];

  groups.forEach((group, groupIndex) => {
    group.products.forEach((product, productIndex) => {
      const referenceUrl = product.referenceUrl;
      if (referenceUrl === null) return;

      const isHostOnly = isHostOnlyProductName(product.name, referenceUrl);
      if (!isHostOnly && !group.doubtful) return;

      found.push({
        groupIndex,
        productIndex,
        name: product.name,
        referenceUrl,
        // The host-only case is the more specific of the two, so it wins the wording when both hold.
        reason: isHostOnly ? "host-only-name" : "doubtful-group",
      });
    });
  });

  return found;
}
