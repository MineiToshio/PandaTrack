import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Transaction-refusal regression guard (ADR 0022).
 *
 * Returning normally from a `prisma.$transaction` callback COMMITS the transaction; only a thrown
 * error rolls it back. A mutation that issues a write and then returns `{ ok: false, error: … }`
 * therefore persists that write while telling the caller — and the user — that it failed. This
 * shipped four separate times before it was named, the worst case leaving a phantom order row with
 * no items and no history entry in the collector's list.
 *
 * This scan flags a literal refusal return positioned after the first write inside two scopes:
 *
 *   A. the callback passed to `prisma.$transaction(...)`;
 *   B. the body of any function taking a `Prisma.TransactionClient`, since it runs inside a
 *      caller's transaction and its returns are that transaction's returns.
 *
 * A write counts as a write whether it is issued directly or through a helper: a same-file function
 * taking a `Prisma.TransactionClient` whose body contains a direct write is itself treated as one,
 * so `writeStorePaymentWithAllocations(tx, …)` is a write at its call site. Without that,
 * extracting the write into a helper — which is ordinary refactoring, not a workaround — silently
 * takes a mutation out of the scan.
 *
 * WHAT IT CANNOT SEE, by design — it is a net for the shape that caused the incidents, not a proof:
 *
 *   - a refusal returned through a variable (`return applied`) rather than an object literal, which
 *     is the shape `applyBaseCurrencyChange` had;
 *   - a write issued through a helper declared in ANOTHER file, or reached through more than one
 *     hop of indirection. `parseAndApplyCollectorPreferencesPatch` is the live example: it takes a
 *     `Prisma.TransactionClient` and relays a `{ ok: false }`, but its write is two hops down
 *     (`applyCollectorPreferencesPatch` → `applyCollectorPreferencesPatchWithin`), so this scan
 *     reads its scope as having no write at all. Its ordering is covered behaviourally instead, by
 *     `src/lib/data/user-settings/_tests/collectorPreferencesRefusalOrder.test.ts`.
 *
 * Chasing that second hop by making the helper vocabulary transitive is NOT the fix, and was tried:
 * it turns the whole `applyCollectorPreferencesPatch(...)` call into a single opaque "write", so the
 * catch-and-relay below it reads as a refusal after a write even though every refusal inside is
 * decided before the first one. It produced exactly one repo-wide hit, and that hit was a false
 * positive on correct code. A relayed refusal is textually indistinguishable from the bug; only the
 * behavioural test can tell them apart.
 *
 * `.agents/rules/prisma-data-layer.mdc` carries the actual contract. A green run here is not
 * evidence that a mutation is safe.
 *
 * FIXING A HIT: hoist the refusal above the first write, or throw a typed sentinel inside the
 * transaction and map it back to the same public result in a `.catch` outside. Never relax the scan.
 */

const DATA_DIR = join(process.cwd(), "src/lib/data");

/** Direct write through a transaction client. Reads (`findMany`, `aggregate`, `count`) are safe. */
const WRITE_CALL =
  /\b(?:tx|trx)\.(?:\$executeRaw|\$executeRawUnsafe|[A-Za-z]\w*\.(?:create|createMany|createManyAndReturn|update|updateMany|upsert|delete|deleteMany))\b/g;

const REFUSAL_RETURN = /\breturn\s*\{\s*ok\s*:\s*false/g;

/**
 * `runSerializableTransaction` (src/lib/data/orders/serializableTransaction.ts) is a thin wrapper
 * around `prisma.$transaction` with a retry, so the callback it takes is a transaction callback in
 * every sense that matters here. It is matched by name for that reason: without it, moving a
 * mutation onto the wrapper would silently take that mutation out of this scan.
 */
const TRANSACTION_CALL = /(?:\$transaction|runSerializableTransaction)\s*(?:<[^>]*>)?\s*\(/g;

const TX_TAKING_FUNCTION = /\bfunction\s+(\w+)\s*(?:<[^>]*>)?\s*\(/g;

function isTestPath(path: string): boolean {
  return /\.test\.[tj]sx?$/.test(path) || /(?:^|\/)(?:_tests|__tests__)(?:\/|$)/.test(path);
}

function collect(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...collect(full));
    else if (full.endsWith(".ts") && !isTestPath(full)) out.push(full);
  }
  return out;
}

/**
 * Blanks out comments and string/template/regex literal contents, preserving offsets and newlines,
 * so bracket matching and pattern scanning can never trip over code-like text inside them.
 */
function maskLiteralsAndComments(source: string): string {
  const out = source.split("");
  const blank = (from: number, to: number) => {
    for (let k = from; k < to; k += 1) if (out[k] !== "\n") out[k] = " ";
  };

  let i = 0;
  while (i < source.length) {
    const char = source[i];
    const next = source[i + 1];

    if (char === "/" && next === "/") {
      let j = i + 2;
      while (j < source.length && source[j] !== "\n") j += 1;
      blank(i, j);
      i = j;
    } else if (char === "/" && next === "*") {
      let j = i + 2;
      while (j < source.length && !(source[j] === "*" && source[j + 1] === "/")) j += 1;
      blank(i, Math.min(j + 2, source.length));
      i = j + 2;
    } else if (char === '"' || char === "'" || char === "`") {
      let j = i + 1;
      while (j < source.length) {
        if (source[j] === "\\") j += 2;
        else if (source[j] === char) break;
        else j += 1;
      }
      blank(i + 1, j);
      i = j + 1;
    } else {
      i += 1;
    }
  }

  return out.join("");
}

function matchBalanced(masked: string, openIndex: number, open: string, close: string): number {
  let depth = 0;
  for (let k = openIndex; k < masked.length; k += 1) {
    if (masked[k] === open) depth += 1;
    else if (masked[k] === close) {
      depth -= 1;
      if (depth === 0) return k;
    }
  }
  return masked.length;
}

/**
 * Index of the `{` that opens a function's body, or -1 when the declaration has none.
 *
 * The naive `indexOf("{", paramsClose)` lands inside the RETURN-TYPE ANNOTATION whenever there is
 * one: in `): Promise<{ paymentId: string; affectedOrderIds: string[] }> {` the first brace belongs
 * to the object type, so the "body" the scan then reads is a type, contains no write, and the
 * function silently never enters the vocabulary. That hid the three real helpers this guard exists
 * to cover (`writeStorePaymentWithAllocations`, `writeEditableStoreFields`,
 * `parseAndApplyCollectorPreferencesPatch`) and also kept their own bodies out of `transactionScopes`.
 *
 * So: only a brace at angle-bracket depth 0 is the body. `=>` inside a function type
 * (`Promise<() => void>`) is not a closing bracket, and a `;` at depth 0 means an overload
 * signature or an ambient declaration with no body at all.
 */
function bodyBraceIndex(masked: string, paramsClose: number): number {
  let angleDepth = 0;
  for (let k = paramsClose + 1; k < masked.length; k += 1) {
    const char = masked[k];
    if (char === "<") angleDepth += 1;
    else if (char === ">" && masked[k - 1] !== "=" && angleDepth > 0) angleDepth -= 1;
    else if (angleDepth === 0 && char === "{") return k;
    else if (angleDepth === 0 && char === ";") return -1;
  }
  return -1;
}

const lineOf = (source: string, index: number): number => source.slice(0, index).split("\n").length;

type Scope = { start: number; end: number; kind: string };

/**
 * Names of same-file functions that take a `Prisma.TransactionClient` and write through it. A call
 * to one of these inside a transaction scope is a write, so a refusal after it commits exactly as
 * if the write were inlined. Built per file, because these helpers are file-local by convention.
 */
function writingHelperNames(masked: string): string[] {
  const names: string[] = [];
  TX_TAKING_FUNCTION.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TX_TAKING_FUNCTION.exec(masked)) !== null) {
    const paramsOpen = match.index + match[0].length - 1;
    const paramsClose = matchBalanced(masked, paramsOpen, "(", ")");
    if (!masked.slice(paramsOpen, paramsClose).includes("TransactionClient")) continue;
    const bodyOpen = bodyBraceIndex(masked, paramsClose);
    if (bodyOpen === -1) continue;
    const body = masked.slice(bodyOpen, matchBalanced(masked, bodyOpen, "{", "}"));
    WRITE_CALL.lastIndex = 0;
    if (WRITE_CALL.test(body)) names.push(match[1]);
  }
  return names;
}

/** `foo(` but not `function foo(`, so a helper's own declaration is not read as a call to itself. */
function writingHelperCallPattern(names: string[]): RegExp | null {
  if (names.length === 0) return null;
  return new RegExp(String.raw`(?<!\bfunction\s)\b(?:${names.join("|")})\s*\(`, "g");
}

function transactionScopes(masked: string): Scope[] {
  const scopes: Scope[] = [];

  TRANSACTION_CALL.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TRANSACTION_CALL.exec(masked)) !== null) {
    const open = match.index + match[0].length - 1;
    let cursor = open + 1;
    while (cursor < masked.length && /\s/.test(masked[cursor])) cursor += 1;
    // The array form `$transaction([...])` takes no callback, so it has no early return to get wrong.
    if (masked[cursor] === "[") continue;
    scopes.push({ start: open, end: matchBalanced(masked, open, "(", ")"), kind: "$transaction callback" });
  }

  TX_TAKING_FUNCTION.lastIndex = 0;
  while ((match = TX_TAKING_FUNCTION.exec(masked)) !== null) {
    const paramsOpen = match.index + match[0].length - 1;
    const paramsClose = matchBalanced(masked, paramsOpen, "(", ")");
    if (!masked.slice(paramsOpen, paramsClose).includes("TransactionClient")) continue;
    const bodyOpen = bodyBraceIndex(masked, paramsClose);
    if (bodyOpen === -1) continue;
    scopes.push({
      start: bodyOpen,
      end: matchBalanced(masked, bodyOpen, "{", "}"),
      kind: "function taking a TransactionClient",
    });
  }

  return scopes;
}

function findRefusalsAfterWrites(): string[] {
  const hits: string[] = [];

  for (const file of collect(DATA_DIR)) {
    const source = readFileSync(file, "utf8");
    const masked = maskLiteralsAndComments(source);
    const relative = file.slice(file.indexOf("src/lib/data"));
    const helperCall = writingHelperCallPattern(writingHelperNames(masked));

    for (const { start, end, kind } of transactionScopes(masked)) {
      const region = masked.slice(start, end);

      WRITE_CALL.lastIndex = 0;
      const direct = WRITE_CALL.exec(region);
      let viaHelper: RegExpExecArray | null = null;
      if (helperCall) {
        helperCall.lastIndex = 0;
        viaHelper = helperCall.exec(region);
      }
      // Whichever comes first: a refusal is unsafe from the first write onwards, however it was
      // issued.
      const firstWriteIndex = Math.min(direct?.index ?? Infinity, viaHelper?.index ?? Infinity);
      if (!Number.isFinite(firstWriteIndex)) continue;

      REFUSAL_RETURN.lastIndex = 0;
      let refusal: RegExpExecArray | null;
      while ((refusal = REFUSAL_RETURN.exec(region)) !== null) {
        if (refusal.index <= firstWriteIndex) continue;
        hits.push(
          `${relative}:${lineOf(source, start + refusal.index)} — refusal returned after the write on line ` +
            `${lineOf(source, start + firstWriteIndex)} (${kind})`,
        );
      }
    }
  }

  return hits;
}

describe("transaction-refusal guard", () => {
  it("has no refusal returned after a write inside a transaction scope (ADR 0022)", () => {
    const hits = findRefusalsAfterWrites();
    expect(
      hits,
      "Returning from a $transaction callback COMMITS the write above it. Decide the refusal before " +
        `the first write, or throw a typed sentinel and map it back outside:\n${hits.join("\n")}`,
    ).toEqual([]);
  });

  it("still recognizes the bug shape it was written to catch", () => {
    // Locks the scan against a future refactor that quietly stops matching anything. The fixture is
    // `createOrder` as it shipped broken: create first, refuse afterwards.
    const fixture = `
      return prisma.$transaction(async (tx) => {
        const store = await tx.store.findFirst({ where: { id } });
        if (!store) {
          return { ok: false, error: "STORE_NOT_FOUND" };
        }
        const order = await tx.order.create({ data });
        const items = await createOrderItems(tx, order.id, userId, input.items);
        if (!items.ok) {
          return { ok: false, error: "INVALID_PRODUCT_TYPE" };
        }
        return { ok: true, orderId: order.id };
      });
    `;
    const masked = maskLiteralsAndComments(fixture);
    const [scope] = transactionScopes(masked);
    const region = masked.slice(scope.start, scope.end);

    WRITE_CALL.lastIndex = 0;
    const firstWrite = WRITE_CALL.exec(region);
    expect(firstWrite).not.toBeNull();

    REFUSAL_RETURN.lastIndex = 0;
    const refusals = [...region.matchAll(REFUSAL_RETURN)];
    // The pre-write `STORE_NOT_FOUND` return is legitimate; only the post-write one is a hit.
    expect(refusals).toHaveLength(2);
    expect(refusals.filter((r) => r.index > (firstWrite?.index ?? 0))).toHaveLength(1);
  });

  it("sees a write issued through a same-file helper, not only a direct tx.<model>.<write>", () => {
    // `createStorePayment`'s shape: the write is extracted into a helper taking the transaction
    // client. Before this, moving a write behind a helper took the whole mutation out of the scan
    // silently — so "ADR 0022 is covered here" was false for exactly the mutations most worth
    // covering.
    //
    // The helper is copied from `storePaymentMutations.ts:271` WITH its return-type annotation, and
    // that detail is the test. An earlier version of this fixture dropped the annotation, which made
    // it assert a capability the scan did not have on the real file: the first `{` after the
    // parameter list belonged to `Promise<{ … }>`, so the real helper was never seen. A fixture that
    // is easier to parse than the code it stands for proves nothing.
    const fixture = `
      export async function writeStorePaymentWithAllocations(
        tx: Prisma.TransactionClient,
        params: Params,
      ): Promise<{ paymentId: string; affectedOrderIds: string[] }> {
        const payment = await tx.storePayment.create({ data: params });
        return { paymentId: payment.id, affectedOrderIds: [] };
      }

      async function readSomething(tx: Prisma.TransactionClient, id: string): Promise<{ id: string } | null> {
        return tx.order.findFirst({ where: { id } });
      }

      export async function createStorePayment(input: Input) {
        return runSerializableTransaction(async (tx) => {
          const existing = await readSomething(tx, input.orderId);
          if (!existing) {
            return { ok: false, error: "ORDER_NOT_FOUND" };
          }
          const written = await writeStorePaymentWithAllocations(tx, input);
          if (!written) {
            return { ok: false, error: "WRITE_FAILED" };
          }
          return { ok: true, paymentId: written.paymentId };
        });
      }
    `;
    const masked = maskLiteralsAndComments(fixture);

    // Only the writing helper is in the vocabulary: a read-only helper taking the same client is
    // not a write, or every refusal after any lookup would be flagged.
    const names = writingHelperNames(masked);
    expect(names).toEqual(["writeStorePaymentWithAllocations"]);

    const helperCall = writingHelperCallPattern(names);
    expect(helperCall).not.toBeNull();

    const [scope] = transactionScopes(masked).filter((s) => s.kind === "$transaction callback");
    const region = masked.slice(scope.start, scope.end);

    // No direct write inside the callback at all: this is precisely the blind spot.
    WRITE_CALL.lastIndex = 0;
    expect(WRITE_CALL.exec(region)).toBeNull();

    helperCall!.lastIndex = 0;
    const viaHelper = helperCall!.exec(region);
    expect(viaHelper).not.toBeNull();

    const refusals = [...region.matchAll(REFUSAL_RETURN)];
    expect(refusals).toHaveLength(2);
    // `ORDER_NOT_FOUND` is decided before the write and is fine; `WRITE_FAILED` commits it.
    expect(refusals.filter((r) => r.index > (viaHelper?.index ?? 0))).toHaveLength(1);
  });

  it("sees the real repo helpers, whose declarations all carry a return-type annotation", () => {
    // Asserted against the shipped files rather than a fixture, because the whole failure mode was
    // a fixture that parsed while the code it stood for did not. If a helper is renamed this test
    // should be updated to the new name, never deleted: an empty vocabulary is the silent state
    // this guard is meant to be unable to reach.
    const realHelpers: Array<[string, string]> = [
      ["src/lib/data/orders/storePaymentMutations.ts", "writeStorePaymentWithAllocations"],
      ["src/lib/data/stores/storeGovernanceMutations.ts", "writeEditableStoreFields"],
    ];

    for (const [relative, name] of realHelpers) {
      const masked = maskLiteralsAndComments(readFileSync(join(process.cwd(), relative), "utf8"));
      expect(writingHelperNames(masked), `${relative} → ${name}`).toContain(name);
    }
  });
});
