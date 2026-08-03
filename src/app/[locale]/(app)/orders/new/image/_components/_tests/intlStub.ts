import type { ReactNode } from "react";
import esImageIntake from "@/i18n/locales/es/imageIntake.json";

/**
 * `useTranslations` stand-in for the image-intake component tests.
 *
 * It still answers with `namespace.key` labels instead of real copy, so assertions stay readable and
 * survive a wording change. What it adds over an inline stub is the one rule the inline stubs got
 * wrong: `t` and `t.rich` are NOT interchangeable. Real next-intl throws when a message carries a
 * tag and the plain call is used, so a stub that quietly rendered either way let a regression from
 * `t.rich("guidanceOneOrder", ...)` back to `t("guidanceOneOrder")` pass every test and fail in the
 * browser. The stub therefore reads the real Spanish catalog to learn which messages carry tags, and
 * reproduces both failures: plain `t` on a tagged message, and `t.rich` with a handler missing.
 */

type TagHandler = (chunks: ReactNode) => ReactNode;
type RichValues = Record<string, TagHandler | unknown>;

/** One `<tag>…</tag>` pair, the only rich syntax this catalog uses. */
const TAG_PATTERN = /<([a-z][\w-]*)>[\s\S]*?<\/\1>/gi;

function hasTag(message: string): boolean {
  return new RegExp(TAG_PATTERN.source, "i").test(message);
}

function collectTagNames(message: string): string[] {
  const names = new Set<string>();
  for (const match of message.matchAll(TAG_PATTERN)) {
    names.add(match[1]);
  }
  return [...names];
}

/**
 * Resolves a message the way next-intl does, from the namespace path plus the key. The leading
 * `imageIntake` segment is the catalog itself, so it is dropped before walking.
 */
function readMessage(namespace: string, key: string): string | undefined {
  const path = [...namespace.split(".").slice(1), ...key.split(".")];
  let node: unknown = esImageIntake;
  for (const segment of path) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[segment];
  }
  return typeof node === "string" ? node : undefined;
}

export function createTranslationsStub() {
  return (namespace: string) => {
    const short = (key: string) => `${namespace.split(".").pop()}.${key}`;
    const label = (key: string, values?: Record<string, unknown>) =>
      values && Object.keys(values).length > 0 ? `${short(key)}:${JSON.stringify(values)}` : short(key);

    const translate = (key: string, values?: Record<string, unknown>) => {
      const message = readMessage(namespace, key);
      if (message !== undefined && hasTag(message)) {
        throw new Error(`"${namespace}.${key}" carries rich text tags: call t.rich, not t.`);
      }
      return label(key, values);
    };

    translate.rich = (key: string, values: RichValues) => {
      const handlers: Record<string, TagHandler> = {};
      const plainValues: Record<string, unknown> = {};
      for (const [name, value] of Object.entries(values)) {
        if (typeof value === "function") {
          handlers[name] = value as TagHandler;
        } else {
          plainValues[name] = value;
        }
      }

      const message = readMessage(namespace, key);
      const tagNames = message === undefined ? [] : collectTagNames(message);
      const missing = tagNames.filter((name) => handlers[name] === undefined);
      if (missing.length > 0) {
        throw new Error(`"${namespace}.${key}" has no handler for <${missing.join(">, <")}>.`);
      }

      // The label is wrapped by every tag the real message declares, so a test can assert both the
      // text and the element the tag rendered.
      return tagNames.reduce<ReactNode>((node, name) => handlers[name](node), label(key, plainValues));
    };

    return translate;
  };
}
