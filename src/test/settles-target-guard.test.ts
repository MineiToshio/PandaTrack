import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `settlesTarget` write guard: read-tolerant, write-strict.
 *
 * `PaymentAllocation.settlesTarget` was the original "covered in full, amount unknown" declaration.
 * It is deprecated because it could only be attached to a NEW payment and could never be edited
 * afterwards: undoing one meant deleting the whole payment, and the zero-amount row it wrote showed
 * up in the order's history as a phantom `0.00` line. `OrderItem.paidDeclaredAt` replaced it.
 *
 * READS stay. Nothing has written a `true` row since the `20260808215744` migration backfilled every
 * legacy row to `false`, but a row arriving out of band (a restore, an import) must still render as
 * "Saldado" rather than as that phantom, so the six live read branches are kept on purpose.
 *
 * WRITES do not. `createStorePayment` refuses the field outright, and this scan makes sure no new
 * emitter appears: a re-introduced writer would be a second, non-editable source of truth about the
 * same fact, sitting beside the editable one.
 *
 * The hard part is that a WRITE and a Prisma FIELD SELECTION are spelled identically:
 * `data: { settlesTarget: true }` writes the row, `select: { settlesTarget: true }` merely reads
 * the column, and the repo does the second in two places. So a match is only a hit when the object
 * literal it sits in is not a `select` / `include` / `omit` block, and comments are masked first so
 * prose quoting the payload shape is never a hit either.
 *
 * WHAT IT CANNOT SEE, by design:
 *
 *   - `SETTLES_TARGET_WRITE` matches only the LITERAL `settlesTarget: true`. It cannot see a write
 *     of a non-literal expression, and `storePaymentMutations.ts` has exactly that shape twice:
 *     `settlesTarget: allocation.settlesTarget` at both `writeStorePaymentWithAllocations` (line
 *     374) and inside `createStorePayment`'s own returned payload (line 510). Neither is a hit, and
 *     neither needs to be: `validateAllocations` is the only place `NormalizedAllocationWithLabels`
 *     is built, and it hardcodes `settlesTarget: false` there (line 321) right after refusing any
 *     allocation whose input carried `settlesTarget: true` (line 280, checked BEFORE the amount
 *     checks so `{ amountMinor: 0, settlesTarget: true }` cannot slip past them). So by the time
 *     either non-literal write runs, `allocation.settlesTarget` can only ever be `false` — this scan
 *     does not prove that, `validateAllocations`'s own refusal does, and this comment is the trace
 *     from one to the other. Moving that hardcoded `false` behind a variable, or writing it from
 *     anywhere other than validation's own output, silently reopens the write path this guard exists
 *     to keep shut.
 */

const SRC_DIR = join(process.cwd(), "src");
const SCRIPTS_DIR = join(process.cwd(), "scripts");

const SETTLES_TARGET_WRITE = /settlesTarget\s*[:=]\s*true\b/g;

/** Object literals whose keys are FIELD NAMES being selected, not values being written. */
const READ_ONLY_BLOCK_KEYS = new Set(["select", "include", "omit"]);

function isTestPath(path: string): boolean {
  return /\.test\.[tj]sx?$/.test(path) || /(?:^|\/)(?:_tests|__tests__)(?:\/|$)/.test(path);
}

function collect(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...collect(full));
    else if (/\.tsx?$/.test(full) && !isTestPath(full)) out.push(full);
  }
  return out;
}

/** Blanks comment bodies while preserving offsets, so prose quoting the payload is never a hit. */
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
    } else {
      index += 1;
    }
  }
  return out.join("");
}

/**
 * The key that introduces the object literal containing `index`, or `null` at top level.
 *
 * Walks back to the nearest brace that is still open at that point, then reads the identifier
 * immediately before it. That is exactly enough to tell `select: { settlesTarget: true }` (a column
 * being read) from `data: { settlesTarget: true }` (a row being written).
 */
export function enclosingObjectKey(masked: string, index: number): string | null {
  let depth = 0;
  for (let k = index - 1; k >= 0; k -= 1) {
    const char = masked[k];
    if (char === "}") depth += 1;
    else if (char === "{") {
      if (depth === 0) {
        const before = masked.slice(Math.max(0, k - 40), k);
        const key = /(\w+)\s*:\s*$/.exec(before);
        return key ? key[1] : null;
      }
      depth -= 1;
    }
  }
  return null;
}

export function findSettlesTargetWrites(source: string): number[] {
  const masked = maskComments(source);
  const lines: number[] = [];
  SETTLES_TARGET_WRITE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SETTLES_TARGET_WRITE.exec(masked)) !== null) {
    const key = enclosingObjectKey(masked, match.index);
    if (key !== null && READ_ONLY_BLOCK_KEYS.has(key)) continue;
    lines.push(masked.slice(0, match.index).split("\n").length);
  }
  return lines;
}

describe("settlesTarget write guard", () => {
  it("has no production code writing settlesTarget: true", () => {
    const hits: string[] = [];

    for (const file of [...collect(SRC_DIR), ...collect(SCRIPTS_DIR)]) {
      for (const line of findSettlesTargetWrites(readFileSync(file, "utf8"))) {
        hits.push(`${file.slice(process.cwd().length + 1)}:${line}`);
      }
    }

    expect(
      hits,
      "`settlesTarget` is deprecated on write: an amount-less declaration is `OrderItem.paidDeclaredAt`, " +
        "which is editable and leaves no phantom 0.00 row in an order's payment history.\n" +
        `${hits.join("\n")}`,
    ).toEqual([]);
  });

  it("tells a write apart from the reads it deliberately allows", () => {
    // Without this the scan could quietly stop matching, or start flagging every `select`, and the
    // guard would be either useless or unbearable. Both fixtures are copied from real repo shapes.
    expect(findSettlesTargetWrites(`await tx.paymentAllocation.create({ data: { settlesTarget: true } });`)).toEqual([
      1,
    ]);
    expect(findSettlesTargetWrites(`const allocation = { orderId, amountMinor: 0, settlesTarget: true };`)).toEqual([
      1,
    ]);
    expect(
      findSettlesTargetWrites(`prisma.storePayment.findMany({
        select: { allocations: { select: { amountMinor: true, settlesTarget: true } } },
      });`),
    ).toEqual([]);
    expect(findSettlesTargetWrites(`// a { amountMinor: 0, settlesTarget: true } payload is refused`)).toEqual([]);
    expect(findSettlesTargetWrites(`if (allocation.settlesTarget) return refuse();`)).toEqual([]);
  });

  it("sees the reads that are kept on purpose, so the tolerance is real and not accidental", () => {
    // If these disappear, the deprecation stopped being read-tolerant and a stray `true` row would
    // render as the phantom 0.00 line the whole decision exists to avoid.
    const presentation = readFileSync(join(process.cwd(), "src/lib/orders/storePaymentPresentation.ts"), "utf8");
    expect(presentation).toContain("settlesTarget");

    const validation = readFileSync(join(process.cwd(), "src/lib/orders/storePaymentSheetValidation.ts"), "utf8");
    expect(validation).toContain("settledByDeclaration");
  });
});
