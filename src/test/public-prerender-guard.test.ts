/** @vitest-environment node */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const PUBLIC_ENTRIES = [
  "src/app/[locale]/layout.tsx",
  "src/app/[locale]/(landing)/layout.tsx",
  "src/app/[locale]/(landing)/page.tsx",
  "src/app/[locale]/privacy/page.tsx",
  "src/app/[locale]/terms/page.tsx",
];
const OG_ENTRIES = [
  "src/app/[locale]/opengraph-image.tsx",
  "src/app/[locale]/privacy/opengraph-image.tsx",
  "src/app/[locale]/terms/opengraph-image.tsx",
];

function parse(source: string) {
  return ts.createSourceFile("entry.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function hasModifier(node: ts.FunctionDeclaration, kind: ts.SyntaxKind) {
  return node.modifiers?.some((modifier) => modifier.kind === kind) ?? false;
}

function initializesLocaleBeforeRendering(source: string) {
  const entry = parse(source).statements.find(
    (node): node is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(node) && hasModifier(node, ts.SyntaxKind.DefaultKeyword),
  );
  const statements = entry?.body?.statements;
  if (!statements) return false;

  const initializationIndex = statements.findIndex(
    (node) =>
      ts.isExpressionStatement(node) &&
      ts.isCallExpression(node.expression) &&
      node.expression.expression.getText() === "setRequestLocale" &&
      node.expression.arguments.length === 1 &&
      node.expression.arguments[0].getText() === "locale",
  );
  if (initializationIndex < 0) return false;

  // Only inspect the render entry point: metadata uses explicit locales independently.
  let readsTranslationsOrRenders = false;
  function visit(node: ts.Node) {
    if (
      ts.isJsxElement(node) ||
      ts.isJsxSelfClosingElement(node) ||
      ts.isJsxFragment(node) ||
      (ts.isCallExpression(node) &&
        /^(getMessages|getTranslations|getLocale|useTranslations|useMessages|useLocale)$/.test(
          node.expression.getText(),
        ))
    ) {
      readsTranslationsOrRenders = true;
    }
    ts.forEachChild(node, visit);
  }
  statements.slice(0, initializationIndex).forEach(visit);
  return !readsTranslationsOrRenders;
}

function exportsLocaleParams(source: string) {
  return parse(source).statements.some(
    (node) =>
      ts.isFunctionDeclaration(node) &&
      node.name?.text === "generateStaticParams" &&
      hasModifier(node, ts.SyntaxKind.ExportKeyword) &&
      node.body?.statements.some(
        (statement) =>
          ts.isReturnStatement(statement) &&
          statement.expression &&
          ts.isCallExpression(statement.expression) &&
          statement.expression.expression.getText() === "routing.locales.map",
      ),
  );
}

function readEntry(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("public prerender guard", () => {
  it.each(PUBLIC_ENTRIES)("%s initializes locale before translations and rendering", (path) => {
    expect(initializesLocaleBeforeRendering(readEntry(path)), path).toBe(true);
  });

  it.each(OG_ENTRIES)("%s exports static params for supported locales", (path) => {
    expect(exportsLocaleParams(readEntry(path)), path).toBe(true);
  });

  it.each(PUBLIC_ENTRIES)("detects missing or commented initialization in %s", (path) => {
    const source = readEntry(path);
    expect(initializesLocaleBeforeRendering(source.replace("setRequestLocale(locale);", ""))).toBe(false);
    expect(
      initializesLocaleBeforeRendering(source.replace("setRequestLocale(locale);", "/* setRequestLocale(locale); */")),
    ).toBe(false);
  });

  it("rejects translation reads or rendered descendants before initialization", () => {
    for (const statement of ["const messages = await getMessages();", "const children = <Header />;"]) {
      const source = `export default async function Page() {
        ${statement}
        setRequestLocale(locale);
        return <main />;
      }`;
      expect(initializesLocaleBeforeRendering(source)).toBe(false);
    }
  });

  it("keeps the root layout locale enumeration used by public pages", () => {
    expect(exportsLocaleParams(readEntry(PUBLIC_ENTRIES[0]))).toBe(true);
  });

  it.each(OG_ENTRIES)("detects a removed static params export in %s", (path) => {
    expect(
      exportsLocaleParams(
        readEntry(path).replace("export function generateStaticParams", "function generateStaticParams"),
      ),
    ).toBe(false);
  });
});
