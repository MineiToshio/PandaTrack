/**
 * Finds locale keys that no code appears to reference.
 *
 * ADVISORY ONLY. This is a maintenance aid, not a guard, and it is deliberately
 * NOT wired into `npm run test`. Treat its output as a list of candidates to
 * verify by hand before deleting anything. See `docs/development/i18n.md`.
 *
 * Usage: `npm run find-unused-i18n-keys` (JSON report on stdout, summary on stderr).
 *
 * It walks the TypeScript AST of `src/**` and `e2e/**` and resolves ambiguity
 * toward "used", so it under-reports dead keys rather than over-reporting them.
 * Understood today:
 *   - `t("exact.key")`, plus `t.rich` / `t.raw` / `t.has` / `t.markup`
 *   - namespace binding: `useTranslations("orders.detail")` then `t("hero.title")`
 *   - `getTranslations("ns")` / `getTranslations({ locale, namespace })` in server code
 *   - template keys with a static prefix: t(`detail.history.events.${type}`)
 *   - ternaries and `??` / `||` fallbacks inside the call
 *   - keys held in local consts and object-literal maps (`MAP[state]`, `MAP.x`)
 *   - function parameters, resolved through that file's call sites
 *   - options bags that carry a namespace and a `*Key` together (buildPageMetadata)
 *   - direct catalog imports, static and dynamic, resolved by member chain
 *   - `useMessages()` raw tree access (whole namespace kept live)
 *
 * KNOWN BLIND SPOT, and the reason this is not a blocking test: the analysis is
 * per file. A translator handed to a helper in a DIFFERENT module loses its
 * namespace binding, and every key that helper reaches would be reported dead.
 * No code does that today (the six `ReturnType<typeof useTranslations>` helpers
 * are all declared in the file that binds `t`), so the tool is accurate on the
 * current tree, but a refactor that extracts one of them would silently make it
 * lie. Same risk for any key assembled by means it cannot follow, e.g. `.join(".")`.
 *
 * Locale-to-locale drift IS provable, and is enforced separately as a real test
 * in `src/test/i18n-locale-parity.test.ts`.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const LOCALES_DIR = join(ROOT, "src", "i18n", "locales");

const FILE_TO_NS = {
  "common.json": "common",
  "landing.json": "landing",
  "terms.json": "terms",
  "privacy.json": "privacy",
  "auth.json": "auth",
  "dashboard.json": "dashboard",
  "app-layout.json": "appLayout",
  "stores.json": "stores",
  "storeListing.json": "storeListing",
  "countries.json": "countries",
  "storeProductTypes.json": "storeProductTypes",
  "settings.json": "settings",
  "notifications.json": "notifications",
  "orders.json": "orders",
  "orderListing.json": "orderListing",
  "imageIntake.json": "imageIntake",
  "productBreakdown.json": "productBreakdown",
  "deliveries.json": "deliveries",
  "components.json": "components",
  "admin.json": "admin",
};

const TRANSLATOR_FACTORIES = new Set(["useTranslations", "getTranslations"]);
const TRANSLATOR_METHODS = new Set(["rich", "raw", "has", "markup"]);

function flatten(value, prefix, out) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [k, v] of Object.entries(value)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  } else {
    out.add(prefix);
  }
}

function collectLocaleKeys() {
  const byNs = new Map();
  for (const locale of readdirSync(LOCALES_DIR)) {
    const dir = join(LOCALES_DIR, locale);
    if (!statSync(dir).isDirectory()) continue;
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".json")) continue;
      const ns = FILE_TO_NS[file];
      if (!ns) throw new Error(`Unmapped locale file: ${file}`);
      const keys = new Set();
      flatten(JSON.parse(readFileSync(join(dir, file), "utf8")), "", keys);
      if (!byNs.has(ns)) byNs.set(ns, new Set());
      for (const k of keys) byNs.get(ns).add(k);
    }
  }
  return byNs;
}

const SCAN_DIRS = [join(ROOT, "src"), join(ROOT, "e2e")];
const SKIP_DIR = new Set(["node_modules", ".next", "locales"]);

function collectSources() {
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      if (SKIP_DIR.has(entry)) continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx|mts|cts|js|jsx|mjs)$/.test(entry)) files.push(full);
    }
  };
  for (const d of SCAN_DIRS) walk(d);
  return files;
}

const ALL_NS = Symbol("all-namespaces");

const usedExact = new Set();
const usedPrefix = new Set();
const liveNamespaces = new Set();
const allStringLiterals = new Set();
const globalPropValues = new Map(); // propName -> Set(string literal values)
const evidence = new Map();
const diag = { opaque: [], allNsFiles: [], messagesFiles: [], rootOpaque: [] };

function note(k, where) {
  if (!evidence.has(k)) evidence.set(k, new Set());
  if (evidence.get(k).size < 6) evidence.get(k).add(where);
}

function unwrap(n) {
  while (
    n &&
    (ts.isAsExpression(n) ||
      ts.isTypeAssertionExpression(n) ||
      ts.isParenthesizedExpression(n) ||
      ts.isNonNullExpression(n) ||
      (ts.isSatisfiesExpression && ts.isSatisfiesExpression(n)))
  ) {
    n = n.expression;
  }
  return n;
}

const parse = (file) =>
  ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

// ---------------- Pass 1: global indices ----------------
// Options-bag helpers (buildPageMetadata({ namespace, titleKey })) pass the
// namespace and the key as sibling properties of one object literal. Pair them
// here so the generic helper's own `t(titleKey)` does not read as opaque.
function indexPass(files) {
  for (const file of files) {
    const src = parse(file);
    const walk = (node) => {
      if (ts.isPropertyAssignment(node)) {
        const name = ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) ? node.name.text : null;
        const init = unwrap(node.initializer);
        if (name && init && (ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init))) {
          if (!globalPropValues.has(name)) globalPropValues.set(name, new Set());
          globalPropValues.get(name).add(init.text);
        }
      }
      if (ts.isObjectLiteralExpression(node)) {
        let ns = null;
        const keyProps = [];
        for (const p of node.properties) {
          if (!ts.isPropertyAssignment(p)) continue;
          const pname = ts.isIdentifier(p.name) || ts.isStringLiteral(p.name) ? p.name.text : null;
          const init = unwrap(p.initializer);
          const lit = init && (ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init)) ? init.text : null;
          if (pname === "namespace" && lit) ns = lit;
          else if (pname && /key$/i.test(pname) && lit) keyProps.push(lit);
        }
        if (ns) {
          for (const k of keyProps) {
            usedExact.add(`${ns}.${k}`);
            note(`${ns}.${k}`, `${relative(ROOT, file)} (options bag)`);
          }
        }
      }
      ts.forEachChild(node, walk);
    };
    walk(src);
  }
}

// ---------------- Pass 2: per-file analysis ----------------
function analyzeFile(file, byNs) {
  const text = readFileSync(file, "utf8");
  const rel = relative(ROOT, file);
  const src = parse(file);
  const lineOf = (n) => src.getLineAndCharacterOfPosition(n.getStart(src)).line + 1;

  const varInit = new Map();
  const funcParams = new Map();
  const callArgsByFunc = new Map();
  const paramOwner = new Map();

  const index = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      if (!varInit.has(node.name.text)) varInit.set(node.name.text, node.initializer);
    }
    let fnName = null;
    let params = null;
    if (ts.isFunctionDeclaration(node) && node.name) {
      fnName = node.name.text;
      params = node.parameters;
    } else if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
    ) {
      fnName = node.name.text;
      params = node.initializer.parameters;
    }
    if (fnName && params) {
      const names = params.map((p) => (ts.isIdentifier(p.name) ? p.name.text : null));
      funcParams.set(fnName, names);
      names.forEach((pn, i) => {
        if (pn && !paramOwner.has(pn)) paramOwner.set(pn, { func: fnName, index: i });
      });
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const n = node.expression.text;
      if (!callArgsByFunc.has(n)) callArgsByFunc.set(n, []);
      callArgsByFunc.get(n).push(node.arguments);
    }
    ts.forEachChild(node, index);
  };
  index(src);

  // `allowGlobalProps` is off when resolving a NAMESPACE argument: the repo-wide
  // property index would answer `namespace` with every namespace ever written in
  // an options bag, which silently marks the whole app live.
  function resolveArg(node, depth, seen, allowGlobalProps = true) {
    node = unwrap(node);
    if (!node || depth > 6) return [{ opaque: true }];

    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [{ literal: node.text }];
    if (ts.isTemplateExpression(node)) {
      const head = node.head.text;
      const cut = head.lastIndexOf(".");
      if (cut === -1) return [{ opaque: true }];
      return [{ prefix: head.slice(0, cut + 1) }];
    }
    if (ts.isConditionalExpression(node)) {
      return [...resolveArg(node.whenTrue, depth + 1, seen, allowGlobalProps), ...resolveArg(node.whenFalse, depth + 1, seen, allowGlobalProps)];
    }
    if (ts.isBinaryExpression(node)) {
      const op = node.operatorToken.kind;
      if (
        op === ts.SyntaxKind.QuestionQuestionToken ||
        op === ts.SyntaxKind.BarBarToken ||
        op === ts.SyntaxKind.AmpersandAmpersandToken
      ) {
        return [...resolveArg(node.left, depth + 1, seen, allowGlobalProps), ...resolveArg(node.right, depth + 1, seen, allowGlobalProps)];
      }
      return [{ opaque: true }];
    }
    if (ts.isElementAccessExpression(node) || ts.isPropertyAccessExpression(node)) {
      const objName = ts.isIdentifier(node.expression) ? node.expression.text : null;
      if (objName && varInit.has(objName)) {
        const obj = unwrap(varInit.get(objName));
        if (obj && ts.isObjectLiteralExpression(obj)) {
          const wanted = ts.isPropertyAccessExpression(node) ? node.name.text : null;
          const out = [];
          for (const p of obj.properties) {
            if (!ts.isPropertyAssignment(p)) continue;
            const pname = ts.isIdentifier(p.name) || ts.isStringLiteral(p.name) ? p.name.text : null;
            if (wanted && pname !== wanted) continue;
            out.push(...resolveArg(p.initializer, depth + 1, seen, allowGlobalProps));
          }
          if (out.length) return out;
        }
      }
      // `props.titleKey` on a generic helper: fall back to the global index.
      const propName = ts.isPropertyAccessExpression(node) ? node.name.text : null;
      if (allowGlobalProps && propName && /key$/i.test(propName) && globalPropValues.has(propName)) {
        return [...globalPropValues.get(propName)].map((v) => ({ literal: v }));
      }
      return [{ opaque: true }];
    }
    if (ts.isIdentifier(node)) {
      if (seen.has(node.text)) return [{ opaque: true }];
      const next = new Set(seen).add(node.text);
      if (varInit.has(node.text)) return resolveArg(varInit.get(node.text), depth + 1, next, allowGlobalProps);
      const owner = paramOwner.get(node.text);
      if (owner) {
        const calls = callArgsByFunc.get(owner.func) ?? [];
        const out = [];
        for (const args of calls) {
          const a = args[owner.index];
          if (a) out.push(...resolveArg(a, depth + 1, next, allowGlobalProps));
        }
        if (out.length) return out;
      }
      // A destructured options-bag property used as a key: resolve repo-wide.
      if (allowGlobalProps && /key$/i.test(node.text) && globalPropValues.has(node.text)) {
        return [...globalPropValues.get(node.text)].map((v) => ({ literal: v }));
      }
      return [{ opaque: true }];
    }
    return [{ opaque: true }];
  }

  // ---- translator bindings ----
  const bindings = new Map();
  const nsInFile = new Set();
  let sawUnresolvableNs = false;
  const fileLiterals = new Set();

  const readNsArg = (call) => {
    const arg = call.arguments[0];
    if (!arg) return "";
    const inner = unwrap(arg);
    if (ts.isObjectLiteralExpression(inner)) {
      for (const p of inner.properties) {
        if (ts.isPropertyAssignment(p) && p.name.getText(src) === "namespace") {
          const v = unwrap(p.initializer);
          if (ts.isStringLiteralLike(v)) return v.text;
          return ALL_NS;
        }
      }
      return "";
    }
    // Namespaces can be conditional: useTranslations(cond ? "auth.signUp" : "auth.signIn")
    const shapes = resolveArg(inner, 0, new Set(), false);
    const lits = shapes.filter((s) => s.literal !== undefined).map((s) => s.literal);
    if (lits.length && shapes.every((s) => s.literal !== undefined)) return lits;
    return ALL_NS;
  };

  const bindPass = (node) => {
    if (ts.isVariableDeclaration(node) && node.initializer && ts.isIdentifier(node.name)) {
      let init = unwrap(node.initializer);
      if (init && ts.isAwaitExpression(init)) init = unwrap(init.expression);
      if (
        init &&
        ts.isCallExpression(init) &&
        ts.isIdentifier(init.expression) &&
        TRANSLATOR_FACTORIES.has(init.expression.text)
      ) {
        const ns = readNsArg(init);
        bindings.set(node.name.text, ns);
        if (ns === ALL_NS) sawUnresolvableNs = true;
        else for (const n of Array.isArray(ns) ? ns : [ns]) nsInFile.add(n);
      }
    }
    ts.forEachChild(node, bindPass);
  };
  bindPass(src);
  if (sawUnresolvableNs) diag.allNsFiles.push(rel);

  const rootNsInFile = new Set();
  for (const ns of nsInFile) rootNsInFile.add(ns.split(".")[0]);

  // When the namespace is unresolvable, restrict candidates to namespaces this
  // file actually names as a string literal (type unions count, since they parse
  // as string literals). Only a file naming none falls back to everything.
  const candidateNsList = () => {
    if (!sawUnresolvableNs && nsInFile.size > 0) return [...nsInFile];
    const named = [...byNs.keys()].filter((ns) => fileLiterals.has(ns));
    return named.length ? named : [...byNs.keys()];
  };

  const record = (nsScope, arg, node) => {
    const where = `${rel}:${lineOf(node)}`;
    const scopes =
      nsScope === ALL_NS ? candidateNsList() : Array.isArray(nsScope) ? nsScope : [nsScope];
    for (const shape of resolveArg(arg, 0, new Set())) {
      for (const ns of scopes) {
        if (shape.literal !== undefined) {
          const full = ns ? `${ns}.${shape.literal}` : shape.literal;
          usedExact.add(full);
          note(full, where);
        } else if (shape.prefix !== undefined) {
          const full = ns ? `${ns}.${shape.prefix}` : shape.prefix;
          usedPrefix.add(full);
          note(`PFX:${full}`, where);
        } else if (ns) {
          usedPrefix.add(`${ns}.`);
          note(`OPAQUE:${ns}.`, where);
          diag.opaque.push(`${ns}. <- ${where}`);
        } else {
          // Rootless translator with an unresolvable key: cannot be scoped at
          // all. Recorded loudly rather than silently blanking every namespace.
          diag.rootOpaque.push(where);
          for (const n of byNs.keys()) usedPrefix.add(`${n}.`);
        }
      }
    }
  };

  const translatorPass = (node) => {
    if (ts.isStringLiteralLike(node)) {
      allStringLiterals.add(node.text);
      fileLiterals.add(node.text);
    }
    if (ts.isTemplateExpression(node) && node.head.text) {
      allStringLiterals.add(node.head.text);
      fileLiterals.add(node.head.text);
    }
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      let name = null;
      if (ts.isIdentifier(callee)) name = callee.text;
      else if (
        ts.isPropertyAccessExpression(callee) &&
        ts.isIdentifier(callee.expression) &&
        TRANSLATOR_METHODS.has(callee.name.text)
      ) {
        name = callee.expression.text;
      }
      if (name && bindings.has(name) && node.arguments.length > 0) {
        record(bindings.get(name), node.arguments[0], node);
      }
    }
    ts.forEachChild(node, translatorPass);
  };
  // fileLiterals must be complete before candidateNsList() runs, so collect first.
  const litPass = (node) => {
    if (ts.isStringLiteralLike(node)) fileLiterals.add(node.text);
    ts.forEachChild(node, litPass);
  };
  litPass(src);
  translatorPass(src);

  // ---- direct locale-JSON imports: resolve member chains precisely ----
  // `import esOrders from "@/i18n/locales/es/orders.json"` then
  // `esOrders.createEntry.fromImage.photosRemaining` is an exact key; a chain
  // that stops short (Object.values(esImageIntake.quota)) covers its subtree.
  const jsonBindings = new Map(); // local name -> namespace
  for (const st of src.statements) {
    if (!ts.isImportDeclaration(st) || !ts.isStringLiteral(st.moduleSpecifier)) continue;
    const m = st.moduleSpecifier.text.match(/i18n\/locales\/[^/]+\/([\w-]+)\.json$/);
    if (!m) continue;
    const ns = FILE_TO_NS[`${m[1]}.json`];
    if (ns && st.importClause?.name) jsonBindings.set(st.importClause.name.text, ns);
  }
  // `const m = (await import("@/i18n/locales/es/auth.json")).default` and the
  // ternary form used by the transactional emails.
  const dynPass = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const found = new Set();
      const scan = (n) => {
        if (
          ts.isCallExpression(n) &&
          n.expression.kind === ts.SyntaxKind.ImportKeyword &&
          n.arguments[0] &&
          ts.isStringLiteral(n.arguments[0])
        ) {
          const mm = n.arguments[0].text.match(/i18n\/locales\/[^/]+\/([\w-]+)\.json$/);
          if (mm && FILE_TO_NS[`${mm[1]}.json`]) found.add(FILE_TO_NS[`${mm[1]}.json`]);
        }
        ts.forEachChild(n, scan);
      };
      scan(node.initializer);
      // One binding can only carry one catalog shape; if a ternary picks between
      // locales of the same file, they map to the same namespace anyway.
      for (const ns of found) jsonBindings.set(node.name.text, ns);
    }
    ts.forEachChild(node, dynPass);
  };
  dynPass(src);

  if (jsonBindings.size > 0) {
    const chainPass = (node) => {
      if (
        ts.isPropertyAccessExpression(node) &&
        !(node.parent && ts.isPropertyAccessExpression(node.parent) && node.parent.expression === node)
      ) {
        const segs = [];
        let cur = node;
        while (ts.isPropertyAccessExpression(cur)) {
          segs.unshift(cur.name.text);
          cur = cur.expression;
        }
        if (ts.isIdentifier(cur) && jsonBindings.has(cur.text)) {
          const ns = jsonBindings.get(cur.text);
          const path = `${ns}.${segs.join(".")}`;
          usedExact.add(path);
          usedPrefix.add(`${path}.`);
          note(path, `${rel}:${lineOf(node)} (JSON import chain)`);
        }
      }
      ts.forEachChild(node, chainPass);
    };
    chainPass(src);
    // A bare reference to the imported object (not via a property) is opaque.
    const bareUse = (node) => {
      if (ts.isIdentifier(node) && jsonBindings.has(node.text)) {
        const p = node.parent;
        const viaProp = p && ts.isPropertyAccessExpression(p) && p.expression === node;
        const isImport = p && ts.isImportClause(p);
        if (!viaProp && !isImport) {
          const ns = jsonBindings.get(node.text);
          liveNamespaces.add(ns);
          note(`NS:${ns}`, `${rel}:${lineOf(node)} (whole catalog referenced)`);
        }
      }
      ts.forEachChild(node, bareUse);
    };
    bareUse(src);
  }

  // useMessages() hands over the raw tree; chains there run through helpers, so
  // fall back to namespaces this file names.
  if (/useMessages\s*\(/.test(text)) {
    diag.messagesFiles.push(rel);
    for (const ns of byNs.keys()) {
      const named = fileLiterals.has(ns) || new RegExp(`[./\\[\\s"']${ns}\\b`).test(text);
      if (rootNsInFile.has(ns) || named) {
        liveNamespaces.add(ns);
        note(`NS:${ns}`, `${rel} (useMessages)`);
      }
    }
  }
}

function main() {
  const byNs = collectLocaleKeys();
  const files = collectSources();
  indexPass(files);
  for (const f of files) analyzeFile(f, byNs);

  const prefixes = [...usedPrefix];
  const report = {};
  for (const [ns, keys] of byNs) {
    const dead = [];
    for (const rel of keys) {
      const full = `${ns}.${rel}`;
      const segs = full.split(".");
      let reason = null;
      if (liveNamespaces.has(ns)) reason = "namespace read opaquely";
      else if (usedExact.has(full)) reason = "exact t() literal";
      else if (prefixes.some((p) => full.startsWith(p))) reason = "dynamic/opaque prefix";
      else if (allStringLiterals.has(full)) reason = "full path literal";
      else {
        for (let i = 1; i < segs.length - 1; i++) {
          if (allStringLiterals.has(segs.slice(i).join("."))) {
            reason = "suffix literal";
            break;
          }
        }
      }
      if (!reason) dead.push(rel);
    }
    report[ns] = { total: keys.size, dead };
  }

  console.log(JSON.stringify(report, null, 2));
  console.error("=== SUMMARY ===");
  let t = 0,
    d = 0;
  for (const [ns, r] of Object.entries(report)) {
    t += r.total;
    d += r.dead.length;
    console.error(
      `${ns.padEnd(20)} total=${String(r.total).padStart(4)}  dead=${String(r.dead.length).padStart(4)}`,
    );
  }
  console.error(`TOTAL total=${t} dead=${d}`);
  console.error(`\nfully-live namespaces: ${[...liveNamespaces].join(", ") || "(none)"}`);
  console.error(`unresolvable-namespace files: ${diag.allNsFiles.join(", ") || "(none)"}`);
  console.error(`ROOTLESS OPAQUE (blankets everything): ${[...new Set(diag.rootOpaque)].join(", ") || "(none)"}`);
  console.error(`\n=== OPAQUE SUBTREES (orders/stores) ===`);
  console.error(
    [...new Set(diag.opaque)].filter((s) => /^(orders|stores)\./.test(s)).sort().join("\n") || "(none)",
  );
}

main();
