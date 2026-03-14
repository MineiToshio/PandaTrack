import { randomBytes } from "node:crypto";

const FALLBACK_SLUG_BASE = "store";

/**
 * Turns a store name into a URL-safe slug base: lowercase, hyphens for spaces/special chars,
 * collapsed hyphens, trimmed. Returns FALLBACK_SLUG_BASE if result would be empty.
 */
export function slugifyName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return FALLBACK_SLUG_BASE;
  const normalized = trimmed
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized || FALLBACK_SLUG_BASE;
}

/**
 * Generates a 6-character alphanumeric suffix for collision-resistant slugs.
 * Uses hex encoding (0-9, a-f) for simplicity and URL safety.
 */
export function generateShortId(): string {
  return randomBytes(3).toString("hex");
}

/**
 * Produces a stable, SEO-friendly store slug: slugified name + 6-char short id.
 * Slugs do not change when the store name is updated (BR-3).
 */
export function generateStoreSlug(name: string): string {
  const base = slugifyName(name);
  const suffix = generateShortId();
  return `${base}-${suffix}`;
}
