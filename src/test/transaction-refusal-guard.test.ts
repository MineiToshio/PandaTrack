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
 * WHAT IT CANNOT SEE, by design — it is a net for the shape that caused the incidents, not a proof:
 *
 *   - a refusal returned through a variable (`return applied`) rather than an object literal, which
 *     is the shape `applyBaseCurrencyChange` had;
 *   - a write issued inside a helper the callback calls, rather than a direct `tx.<model>.<write>`.
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

const TX_TAKING_FUNCTION = /\bfunction\s+\w+\s*(?:<[^>]*>)?\s*\(/g;

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

const lineOf = (source: string, index: number): number => source.slice(0, index).split("\n").length;

type Scope = { start: number; end: number; kind: string };

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
    const bodyOpen = masked.indexOf("{", paramsClose);
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

    for (const { start, end, kind } of transactionScopes(masked)) {
      const region = masked.slice(start, end);

      WRITE_CALL.lastIndex = 0;
      const firstWrite = WRITE_CALL.exec(region);
      if (!firstWrite) continue;

      REFUSAL_RETURN.lastIndex = 0;
      let refusal: RegExpExecArray | null;
      while ((refusal = REFUSAL_RETURN.exec(region)) !== null) {
        if (refusal.index <= firstWrite.index) continue;
        hits.push(
          `${relative}:${lineOf(source, start + refusal.index)} — refusal returned after the write on line ` +
            `${lineOf(source, start + firstWrite.index)} (${kind})`,
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
});
