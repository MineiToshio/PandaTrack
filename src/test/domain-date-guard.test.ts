import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Domain-date validation guard.
 *
 * A domain date (`orderDate`, `paymentDate`, `receivedDate`, `expectedArrival*`,
 * `expectedDelivery*`) is a calendar day persisted at UTC midnight — see `src/lib/domainDate.ts`.
 * Declaring one with a bare `z.coerce.date()` is safe for exactly one kind of caller and silently
 * wrong for the other:
 *
 *   - a FORM route sends `yyyy-mm-dd` TEXT through `FormData`; coercion reads a date-only string as
 *     UTC midnight, so the value lands right. The order/delivery create+edit routes are these, and
 *     they were never affected.
 *   - a SERVER ACTION route sends a real `Date`; coercion passes it through untouched, so a
 *     picker's local-midnight value is persisted as its raw instant — that day at 05:00Z from Lima.
 *
 * Nothing in the type system tells the two apart, so the second shipped three times before it was
 * found by auditing the rows: three `store_payment`, two `order_payment` and two
 * `delivery.receivedDate` rows sitting five hours off every other date in the collection.
 * `domainDateSchema` (`src/lib/domainDateSchema.ts`) closes it by refusing a non-midnight `Date`,
 * and this scan makes sure every domain-date field is actually declared with it.
 *
 * WHAT IT CANNOT SEE, by design:
 *
 *   - a domain-date field declared through an alias or a `.extend()`d shape whose key is not
 *     literally in the source next to its `z.` declaration;
 *   - the CLIENT half of the contract (whether a component called `toDomainDate` before handing a
 *     `Date` to a Server Action). Tracing that statically needs dataflow — a value can arrive
 *     already normalized from server-loaded props, so the shape alone does not say. That half is
 *     enforced at runtime instead, by `domainDateSchema` refusing.
 *
 * FIXING A HIT: import `domainDateSchema` and declare the field with it, keeping any `.refine`
 * chain. Then make sure the client that feeds it converts with `toDomainDate`. Never relax the scan.
 */

const SRC_DIR = join(process.cwd(), "src");
const PRISMA_SCHEMA = join(process.cwd(), "prisma/schema.prisma");

/** The module that legitimately owns the raw `z.coerce.date()`, since it IS the replacement. */
const SCHEMA_OWNER = "src/lib/domainDateSchema.ts";

/**
 * Domain-date field names are DERIVED from the Prisma schema rather than hardcoded, so a new
 * calendar-day column joins the vocabulary the day it is added instead of the day someone
 * remembers to update this file. A domain date is a `DateTime` column whose name ends in `Date` or
 * reads as an expected-window bound; every other `DateTime` in the schema is a true instant
 * (`createdAt`, `expiresAt`, `approvedAt`, `sentAt`) and must NOT be pinned to midnight.
 */
function domainDateFieldNamesFromPrisma(): string[] {
  const schema = readFileSync(PRISMA_SCHEMA, "utf8");
  const names = new Set<string>();
  for (const [, field] of schema.matchAll(/^\s+(\w+)\s+DateTime\b/gm)) {
    if (/Date$/.test(field) || /^expected\w*(?:From|To)$/.test(field)) names.add(field);
  }
  // `shippedDate` exists only at the validation layer: the quick-arrival payload carries it and the
  // mutation stores it in `delivery.deliveryDate`, so it has no column of its own to be derived
  // from. It is a domain date in every other sense.
  names.add("shippedDate");
  return [...names];
}

/**
 * `paymentDate: z.coerce.date()` and the prettier-wrapped `receivedDate: z.coerce\n  .date()` are
 * the same declaration; `\s` spans the newline, so both forms match. `z.date()` is included because
 * it is the other way to declare a `Date` field without normalizing it.
 */
function rawDateDeclarationPattern(fieldNames: string[]): RegExp {
  return new RegExp(String.raw`\b(${fieldNames.join("|")})\s*:\s*z\s*\.\s*(?:coerce\s*\.\s*)?date\s*\(`, "g");
}

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

/**
 * Blanks out comments and string/template literal contents, preserving offsets and newlines, so a
 * `paymentDate: z.coerce.date()` quoted inside a doc comment (this file's own prose, or the
 * explanation sitting on top of `domainDateSchema`) is never read as a declaration.
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

const lineOf = (source: string, index: number): number => source.slice(0, index).split("\n").length;

function findRawDomainDateDeclarations(): string[] {
  const pattern = rawDateDeclarationPattern(domainDateFieldNamesFromPrisma());
  const hits: string[] = [];

  for (const file of collect(SRC_DIR)) {
    const relative = file.slice(file.indexOf("src/"));
    if (relative === SCHEMA_OWNER) continue;

    const source = readFileSync(file, "utf8");
    const masked = maskLiteralsAndComments(source);

    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(masked)) !== null) {
      hits.push(`${relative}:${lineOf(source, match.index)} — \`${match[1]}\` declared with a raw z date`);
    }
  }

  return hits;
}

describe("domain-date guard", () => {
  it("declares every domain-date field with domainDateSchema, never a raw z.coerce.date()", () => {
    const hits = findRawDomainDateDeclarations();
    expect(
      hits,
      "A domain date must be normalized to UTC midnight. Declare the field with `domainDateSchema` " +
        `from "@/lib/domainDateSchema" (keep any .refine chain):\n${hits.join("\n")}`,
    ).toEqual([]);
  });

  it("derives a non-empty vocabulary that contains the fields the incident touched", () => {
    // An empty or shrunken vocabulary is the silent state this guard must be unable to reach: the
    // scan above would pass for the same reason it would pass on a clean repo.
    const names = domainDateFieldNamesFromPrisma();
    expect(names).toEqual(
      expect.arrayContaining([
        "orderDate",
        "paymentDate",
        "receivedDate",
        "deliveryDate",
        "shippedDate",
        "expectedArrivalFrom",
        "expectedArrivalTo",
        "expectedDeliveryFrom",
        "expectedDeliveryTo",
      ]),
    );
    // True instants must stay out, or the guard would demand midnight from `createdAt`.
    expect(names).not.toContain("createdAt");
    expect(names).not.toContain("expiresAt");
    expect(names).not.toContain("approvedAt");
    expect(names).not.toContain("sentAt");
  });

  it("still recognizes the bug shape it was written to catch, in both formattings", () => {
    // The fixture is `orderValidation.ts` and `deliveryValidation.ts` AS THEY SHIPPED BROKEN,
    // copied verbatim — including prettier's line-wrapped form, which is what `receivedDate` and
    // `shippedDate` actually looked like. A one-line-only pattern would have passed this guard on a
    // repo where the wrapped declarations were the broken ones.
    const fixture = `
      export const storePaymentCreateSchema = z.object({
        storeId: z.string().cuid({ message: "INVALID_STORE_ID" }),
        amount: paymentAmountSchema,
        paymentDate: z.coerce.date().refine((d) => d <= new Date(), { message: "PAYMENT_DATE_IN_FUTURE" }),
        currencyCode: currencyCodeSchema.optional(),
      });

      export const deliveryQuickArrivalSchema = z.object({
        orderId: z.string().cuid({ message: "INVALID_ORDER_ID" }),
        receivedDate: z.coerce.date().refine((d) => d <= new Date(), { message: "RECEIVED_DATE_IN_FUTURE" }),
        shippedDate: z.coerce
          .date()
          .refine((d) => d <= new Date(), { message: "DELIVERY_DATE_IN_FUTURE" })
          .nullable()
          .optional(),
        cost: deliveryCostSchema,
      });
    `;
    const pattern = rawDateDeclarationPattern(domainDateFieldNamesFromPrisma());
    pattern.lastIndex = 0;
    const found = [...maskLiteralsAndComments(fixture).matchAll(pattern)].map((m) => m[1]);
    expect(found).toEqual(["paymentDate", "receivedDate", "shippedDate"]);
  });

  it("does not fire on the fixed shape, nor on a true timestamp", () => {
    // The other half of the fixture: no false positive on what the repo now looks like, and none on
    // an instant field that must NOT be pinned to midnight.
    const fixture = `
      export const storePaymentCreateSchema = z.object({
        paymentDate: domainDateSchema.refine((d) => d <= new Date(), { message: "PAYMENT_DATE_IN_FUTURE" }),
        expectedDeliveryFrom: domainDateSchema.nullable().optional(),
      });

      const auditSchema = z.object({
        createdAt: z.coerce.date(),
        expiresAt: z.coerce.date(),
      });
    `;
    const pattern = rawDateDeclarationPattern(domainDateFieldNamesFromPrisma());
    pattern.lastIndex = 0;
    expect([...maskLiteralsAndComments(fixture).matchAll(pattern)]).toEqual([]);
  });

  it("actually reaches the two validation modules it exists to cover", () => {
    // Asserted against the shipped files, not a fixture: the failure mode worth fearing is a scan
    // that is green because it never looked at the right files. Both modules must be in the swept
    // set AND must declare domain dates through the shared schema.
    const swept = collect(SRC_DIR).map((file) => file.slice(file.indexOf("src/")));
    for (const relative of ["src/lib/orders/orderValidation.ts", "src/lib/deliveries/deliveryValidation.ts"]) {
      expect(swept, relative).toContain(relative);
      const source = readFileSync(join(process.cwd(), relative), "utf8");
      expect(source, relative).toContain('from "@/lib/domainDateSchema"');
      expect(source.match(/domainDateSchema/g)?.length ?? 0, relative).toBeGreaterThan(5);
    }
  });
});
