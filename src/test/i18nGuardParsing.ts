import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Shared scanning primitives for the i18n guard tests.
 *
 * Lives outside the `*.test.ts` glob on purpose: `i18n-referenced-keys-guard.test.ts` and
 * `i18n-placeholder-parity-guard.test.ts` both need the same source-scanning and catalog-loading
 * logic (bound `t` namespaces, comment masking, balanced-call parsing). Importing one spec file
 * from another would re-run its `describe` blocks a second time under the importer's suite, since
 * Vitest registers whatever `describe`/`it` calls happen while a spec file's module graph loads. A
 * plain module has no such calls, so it can be shared without duplicating the parsing logic.
 */

export const SRC_DIR = join(process.cwd(), "src");
export const LOCALES_DIR = join(SRC_DIR, "i18n", "locales");
export const LOCALES = ["es", "en"] as const;

/**
 * Namespace roots, as `src/i18n/request.ts` mounts them: the catalog file name, camel-cased.
 * `app-layout.json` is mounted as `appLayout`.
 */
export function namespaceRootFor(fileName: string): string {
  return fileName.replace(/\.json$/, "").replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
}

export function collectKeyPaths(value: unknown, prefix: string, out: Set<string>): Set<string> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      collectKeyPaths(child, prefix ? `${prefix}.${key}` : key, out);
    }
  } else {
    out.add(prefix);
  }
  return out;
}

/** Every leaf key path a catalog defines, mapped to its raw copy. Non-string leaves stringify. */
export function collectKeyTexts(value: unknown, prefix: string, out: Map<string, string>): Map<string, string> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      collectKeyTexts(child, prefix ? `${prefix}.${key}` : key, out);
    }
  } else {
    out.set(prefix, String(value));
  }
  return out;
}

export function catalogFor(locale: string): Set<string> {
  const out = new Set<string>();
  for (const file of readdirSync(join(LOCALES_DIR, locale))) {
    if (!file.endsWith(".json")) continue;
    const parsed: unknown = JSON.parse(readFileSync(join(LOCALES_DIR, locale, file), "utf8"));
    collectKeyPaths(parsed, namespaceRootFor(file), out);
  }
  return out;
}

/** Same shape as {@link catalogFor}, keeping the copy instead of only the key path. */
export function catalogTextsFor(locale: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const file of readdirSync(join(LOCALES_DIR, locale))) {
    if (!file.endsWith(".json")) continue;
    const parsed: unknown = JSON.parse(readFileSync(join(LOCALES_DIR, locale, file), "utf8"));
    collectKeyTexts(parsed, namespaceRootFor(file), out);
  }
  return out;
}

export function isTestPath(path: string): boolean {
  return /\.test\.[tj]sx?$/.test(path) || /(?:^|\/)(?:_tests|__tests__|test)(?:\/|$)/.test(path);
}

export function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...collectSourceFiles(full));
    else if (/\.tsx?$/.test(full) && !isTestPath(full)) out.push(full);
  }
  return out;
}

/** Blanks comment bodies while preserving offsets, so commented-out code is never scanned. */
export function maskComments(source: string): string {
  const out = source.split("");
  const blank = (from: number, to: number) => {
    for (let k = from; k < to; k += 1) if (out[k] !== "\n") out[k] = " ";
  };

  let index = 0;
  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];
    if (char === "/" && next === "/") {
      let end = index + 2;
      while (end < source.length && source[end] !== "\n") end += 1;
      blank(index, end);
      index = end;
    } else if (char === "/" && next === "*") {
      let end = index + 2;
      while (end < source.length && !(source[end] === "*" && source[end + 1] === "/")) end += 1;
      blank(index, Math.min(end + 2, source.length));
      index = end + 2;
    } else if (char === '"' || char === "'" || char === "`") {
      let end = index + 1;
      while (end < source.length) {
        if (source[end] === "\\") end += 2;
        else if (source[end] === char) break;
        else end += 1;
      }
      index = end + 1;
    } else {
      index += 1;
    }
  }
  return out.join("");
}

/**
 * `const t = useTranslations("orders")`, `const t = await getTranslations({ locale, namespace: "x" })`.
 * A declaration whose namespace is not a literal binds the variable to `null`, which marks it opaque.
 */
const NAMESPACE_DECLARATION =
  /(?:const|let|var)\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\s*\(([^)]*)\)/g;

const LITERAL_NAMESPACE = /^\s*(?:"([^"]+)"|\{[^}]*namespace\s*:\s*"([^"]+)"[^}]*\})\s*$/;

/** Namespaces each translator variable of a file is bound to. `null` marks an opaque binding. */
export function boundNamespaces(masked: string): Map<string, Set<string> | null> {
  const bindings = new Map<string, Set<string> | null>();
  NAMESPACE_DECLARATION.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = NAMESPACE_DECLARATION.exec(masked)) !== null) {
    const [, variable, rawArgs] = match;
    const literal = LITERAL_NAMESPACE.exec(rawArgs);
    const namespace = literal ? (literal[1] ?? literal[2]) : null;
    if (namespace === null) {
      bindings.set(variable, null);
      continue;
    }
    const current = bindings.get(variable);
    if (current === null) continue;
    if (current) current.add(namespace);
    else bindings.set(variable, new Set([namespace]));
  }
  return bindings;
}

/**
 * Every literal key a file asks for, as full catalog paths.
 *
 * A variable bound to more than one namespace (two `t`s in two component scopes of the same file, a
 * shape this repo has) yields one candidate per binding and the key counts as present when ANY of
 * them defines it. Resolving which scope a call sits in would need a real parser; over-reporting
 * here would be a false positive, and a guard that cries wolf gets deleted.
 *
 * `.has(...)` is skipped on purpose: it is the caller explicitly asking whether a key exists.
 */
export function referencedKeyCandidates(masked: string, source: string): Array<{ key: string; candidates: string[] }> {
  const out: Array<{ key: string; candidates: string[] }> = [];
  for (const [variable, namespaces] of boundNamespaces(masked)) {
    if (!namespaces) continue;
    const call = new RegExp(String.raw`\b${variable}\s*(?:\.(?:rich|markup))?\s*\(\s*(["'])([^"'\n]+)\1`, "g");
    let match: RegExpExecArray | null;
    while ((match = call.exec(masked)) !== null) {
      // The masked copy keeps quotes but blanks nothing inside strings, so read the key from the
      // original text at the same offsets.
      const key = source.slice(match.index + match[0].length - match[2].length - 1, match.index + match[0].length - 1);
      if (!key || key.includes("${")) continue;
      out.push({ key, candidates: [...namespaces].map((namespace) => `${namespace}.${key}`) });
    }
  }
  return out;
}

/** Every string literal inside one type declaration: for these unions, exactly its refusal codes. */
export function unionMembers(source: string, typeName: string): string[] {
  const masked = maskComments(source);
  const declaration = new RegExp(String.raw`\btype\s+${typeName}\s*=`).exec(masked);
  if (!declaration) return [];
  const start = declaration.index + declaration[0].length;
  let depth = 0;
  let end = start;
  while (end < masked.length) {
    const char = masked[end];
    if (char === "{" || char === "(" || char === "[") depth += 1;
    else if (char === "}" || char === ")" || char === "]") depth -= 1;
    else if (char === ";" && depth === 0) break;
    end += 1;
  }
  const body = source.slice(start, end);
  const bodyMasked = masked.slice(start, end);
  const members: string[] = [];
  const literal = /"([^"\n]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = literal.exec(bodyMasked)) !== null) {
    members.push(body.slice(match.index + 1, match.index + match[0].length - 1));
  }
  return members;
}

/**
 * One literal `t("key", ...)` / `t.rich("key", ...)` call site, with its second argument classified.
 *
 * `varNames`:
 *   - `[]` when the call passes no second argument at all.
 *   - the object's own top-level property names when the second argument is an inline object
 *     literal every one of whose keys is statically readable (plain or shorthand properties).
 *   - `null` ("opaque") when the second argument is anything else this scan cannot safely read:
 *     a variable reference, a spread (`...rest`), a computed key (`[expr]:`), or `.rich`/`.markup`
 *     calls (whose object holds tag-render FUNCTIONS, not ICU format values, so its keys are not
 *     comparable to the text's `{placeholder}` names at all).
 */
export type LiteralCallSite = {
  variable: string;
  key: string;
  candidates: string[];
  isRich: boolean;
  varNames: string[] | null;
};

const KEY_CALL = /\b(\w+)\s*(\.(?:rich|markup))?\s*\(\s*(["'])([^"'\n]+)\3/g;

/** Depth-0 comma split over `(){}[]`, so a nested call's own commas never break the split. */
function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === "(" || char === "{" || char === "[") depth += 1;
    else if (char === ")" || char === "}" || char === "]") depth -= 1;
    else if (char === "," && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
}

const KEYED_PROPERTY = /^([A-Za-z_$][\w$]*)\s*:/;
const SHORTHAND_PROPERTY = /^([A-Za-z_$][\w$]*)$/;

/** Top-level property names of an inline object literal, or `null` if any property is unreadable. */
function objectLiteralKeys(objectBody: string): string[] | null {
  const trimmed = objectBody.trim();
  if (trimmed === "") return [];
  const names: string[] = [];
  for (const rawSegment of splitTopLevel(trimmed)) {
    const segment = rawSegment.trim();
    if (segment === "") continue;
    if (segment.startsWith("...")) return null;
    const keyed = KEYED_PROPERTY.exec(segment);
    if (keyed) {
      names.push(keyed[1]);
      continue;
    }
    const shorthand = SHORTHAND_PROPERTY.exec(segment);
    if (shorthand) {
      names.push(shorthand[1]);
      continue;
    }
    return null;
  }
  return names;
}

function parseSecondArg(rawArg: string): string[] | null {
  const arg = rawArg.trim();
  if (!arg.startsWith("{") || !arg.endsWith("}")) return null;
  return objectLiteralKeys(arg.slice(1, -1));
}

/**
 * Every literal-key `t(...)` call site in a file, paired with its second argument's variable names
 * where that argument is statically readable. See {@link LiteralCallSite} for what "readable" means.
 *
 * The key text is read straight off `match[4]`: `maskComments` only blanks comment bodies and never
 * touches characters inside quotes, so the masked copy already carries the exact key text — unlike
 * `referencedKeyCandidates`'s offset re-derivation from `source`, which exists there only to match
 * that function's own capture-group layout, not because the masked text is untrustworthy.
 */
export function literalCallSites(masked: string): LiteralCallSite[] {
  const bindings = boundNamespaces(masked);
  const out: LiteralCallSite[] = [];

  KEY_CALL.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = KEY_CALL.exec(masked)) !== null) {
    const [, variable, richSuffix, , key] = match;
    if (!key || key.includes("${")) continue;
    const namespaces = bindings.get(variable);
    if (!namespaces) continue;

    const openParen = masked.indexOf("(", match.index);
    let depth = 1;
    let i = openParen + 1;
    while (i < masked.length && depth > 0) {
      if (masked[i] === "(") depth += 1;
      else if (masked[i] === ")") depth -= 1;
      i += 1;
    }
    const callEnd = i; // one past the closing ')'
    const args = splitTopLevel(masked.slice(openParen + 1, callEnd - 1));

    out.push({
      variable,
      key,
      candidates: [...namespaces].map((namespace) => `${namespace}.${key}`),
      isRich: Boolean(richSuffix),
      varNames: args.length > 1 ? parseSecondArg(args[1]) : [],
    });
  }
  return out;
}
