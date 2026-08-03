/**
 * Pure text heuristics behind the split modal's name proposal on the image-intake review screen.
 * Nothing here gates whether the control is shown: the review screen decides that per group from
 * the extraction result, and since ADR 0023 no other surface offers split or merge at all.
 */

const PACK_PREFIX_PATTERN = /^\s*(pack|box set|combo|set)\b/i;

// Same value as `MAX_ORDER_ITEMS` in orderValidation.ts, duplicated as a literal here rather than
// imported so this module has no dependency on the validation layer.
const MAX_DEDUCED_PARTS = 200;

/**
 * Deduces the part names a closed range implies, e.g. "Pack One Piece 1 al 3" → ["One Piece 1",
 * "One Piece 2", "One Piece 3"]. A leading pack word is stripped from the shared prefix because it
 * names the container, not the product. Returns `null` when no closed range is found, the range is
 * inverted (end before start), or it would produce fewer than 2 or more than `MAX_DEDUCED_PARTS`
 * parts, the caller falls back to asking the user how many parts to split into.
 */
export function deduceRangeParts(name: string): string[] | null {
  const match = name.match(/^(.*?)(\d+)\s*(?:al|a|-|to)\s*(\d+)(.*)$/i);
  if (!match) return null;

  const [, rawPrefix, startText, endText, rawSuffix] = match;
  const start = Number(startText);
  const end = Number(endText);
  if (!Number.isInteger(start) || !Number.isInteger(end) || end < start) return null;

  const count = end - start + 1;
  if (count < 2 || count > MAX_DEDUCED_PARTS) return null;

  const prefix = stripPackPrefix(rawPrefix.trim());
  const suffix = rawSuffix.trim();

  const names: string[] = [];
  for (let n = start; n <= end; n += 1) {
    names.push([prefix, String(n), suffix].filter((segment) => segment.length > 0).join(" "));
  }
  return names;
}

function stripPackPrefix(text: string): string {
  return text.replace(PACK_PREFIX_PATTERN, "").trim();
}
