/**
 * @vitest-environment node
 *
 * The provider module holds the shared API key and is never meant to be loadable in a browser, so
 * this suite runs in the node environment rather than the project-wide jsdom default.
 */
import { describe, expect, it } from "vitest";
import { IMAGE_INTAKE_RESPONSE_SCHEMA } from "@/lib/imageIntake/geminiProvider";

/**
 * Order image intake response-schema guard.
 *
 * The Gemini `generateContent` endpoint accepts only a subset of the OpenAPI schema vocabulary. A
 * keyword outside that subset is not ignored and is not reported per field: the endpoint rejects
 * the whole request with an opaque `HTTP 400 INVALID_ARGUMENT` whose only text is "Request contains
 * an invalid argument". One stray keyword therefore breaks every single extraction, everywhere, and
 * the surface reports it as a generic provider failure.
 *
 * This exact failure already shipped once. `maxItems` was declared on the three array branches as a
 * token-level hint (asking the model to stop before writing a list the Zod contract would reject
 * anyway) and it made 100% of production requests fail, as a number and as the SDK's decimal-string
 * form alike. No test caught it, because every provider test uses a double by design, which is
 * correct for CI and blind to a contract error against the real API.
 *
 * So this file is the cheap half of the answer: a static scan of the schema tree, running in CI on
 * every change, that fails the moment a keyword outside the verified allowlist appears anywhere in
 * it. The other half is `npm run smoke-image-intake`, which sends one real request with this exact
 * schema and is the only thing that can promote a keyword into the allowlist below.
 */

/**
 * Keywords verified to be accepted by `v1beta/models/gemini-3.1-flash-lite:generateContent` with
 * this feature's own schema. `format` is in the list because it was checked in isolation against
 * the live endpoint (`"date"` on a string property returns HTTP 200), not because the SDK's types
 * allow it: the SDK's `Schema` type is far wider than what the endpoint accepts, which is how
 * `maxItems` type-checked its way into production.
 *
 * Nothing may be added here on the strength of documentation or of the SDK typings alone. Verify it
 * against the real endpoint first, the way `maxItems` was eventually verified out.
 */
const ALLOWED_SCHEMA_KEYWORDS = new Set(["type", "properties", "items", "required", "enum", "nullable", "format"]);

/** Keywords known to be rejected, listed so the failure message can name the one that came back. */
const KNOWN_REJECTED_KEYWORDS = new Set(["maxItems", "minItems", "maxLength", "minLength", "maximum", "minimum"]);

type SchemaNode = Record<string, unknown>;

function isSchemaNode(value: unknown): value is SchemaNode {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Every keyword used anywhere in the tree, with the path it was found at. Recurses through
 * `properties` (whose own keys are field names, not keywords) and `items`, so a keyword buried in a
 * nested product or payment branch is found just as a top-level one is.
 */
function collectSchemaKeywords(node: unknown, path: string, found: Map<string, string[]>): void {
  if (!isSchemaNode(node)) {
    return;
  }

  for (const [keyword, value] of Object.entries(node)) {
    const keywordPath = `${path}.${keyword}`;
    const paths = found.get(keyword) ?? [];
    paths.push(keywordPath);
    found.set(keyword, paths);

    if (keyword === "properties" && isSchemaNode(value)) {
      // The keys under `properties` are the draft's own field names, so recursion resumes one
      // level down, on each field's schema.
      for (const [fieldName, fieldSchema] of Object.entries(value)) {
        collectSchemaKeywords(fieldSchema, `${keywordPath}.${fieldName}`, found);
      }
      continue;
    }

    if (keyword === "items") {
      collectSchemaKeywords(value, keywordPath, found);
    }
  }
}

/** Every property of the response schema that carries money, wrapped in a `Field` or standalone. */
const AMOUNT_PROPERTY_NAMES = new Set(["totalCost", "amount", "cost", "unitPrice"]);

/** The declared type of one property: the wrapped `value` for a `Field`, the property itself otherwise. */
function readDeclaredAmountType(node: SchemaNode): unknown {
  const properties = node.properties;
  if (isSchemaNode(properties) && isSchemaNode(properties.value)) {
    return properties.value.type;
  }
  return node.type;
}

function collectAmountPropertyTypes(
  node: unknown,
  path = "root",
  found: [string, unknown][] = [],
): [string, unknown][] {
  if (!isSchemaNode(node)) {
    return found;
  }
  if (isSchemaNode(node.properties)) {
    for (const [fieldName, fieldSchema] of Object.entries(node.properties)) {
      if (!isSchemaNode(fieldSchema)) {
        continue;
      }
      if (AMOUNT_PROPERTY_NAMES.has(fieldName)) {
        found.push([`${path}.${fieldName}`, readDeclaredAmountType(fieldSchema)]);
      }
      collectAmountPropertyTypes(fieldSchema, `${path}.${fieldName}`, found);
    }
  }
  collectAmountPropertyTypes(node.items, `${path}[]`, found);
  return found;
}

function collectSourceEnums(node: unknown, found: string[][] = []): string[][] {
  if (!isSchemaNode(node)) {
    return found;
  }
  if (isSchemaNode(node.properties)) {
    for (const [fieldName, fieldSchema] of Object.entries(node.properties)) {
      if (fieldName === "source" && isSchemaNode(fieldSchema) && Array.isArray(fieldSchema.enum)) {
        found.push(fieldSchema.enum as string[]);
      }
      collectSourceEnums(fieldSchema, found);
    }
  }
  collectSourceEnums(node.items, found);
  return found;
}

describe("image intake response schema guard", () => {
  it("uses only schema keywords verified against the real Gemini endpoint", () => {
    const found = new Map<string, string[]>();
    collectSchemaKeywords(IMAGE_INTAKE_RESPONSE_SCHEMA, "IMAGE_INTAKE_RESPONSE_SCHEMA", found);

    const offenders = [...found.entries()].filter(([keyword]) => !ALLOWED_SCHEMA_KEYWORDS.has(keyword));

    expect(
      offenders.map(([keyword, paths]) => `${keyword} (at ${paths.join(", ")})`),
      "IMAGE_INTAKE_RESPONSE_SCHEMA may only use schema keywords the Gemini generateContent " +
        "endpoint actually accepts: " +
        `${[...ALLOWED_SCHEMA_KEYWORDS].join(", ")}.\n` +
        "An unsupported keyword is not ignored and is not reported per field: the endpoint rejects " +
        'the ENTIRE request with an opaque HTTP 400 ("Request contains an invalid argument"), so ' +
        "every extraction fails, not only the branch carrying the keyword. This already happened " +
        `once, with maxItems.\n` +
        (offenders.some(([keyword]) => KNOWN_REJECTED_KEYWORDS.has(keyword))
          ? "At least one of these is already known to be rejected by the API.\n"
          : "") +
        "If a keyword really is supported, prove it against the live API first with " +
        "`npm run smoke-image-intake` (it sends one real request with this exact schema) and only " +
        "then add it to ALLOWED_SCHEMA_KEYWORDS in this file.",
    ).toEqual([]);
  });

  it("declares every amount as a decimal NUMBER, never an INTEGER", () => {
    // The amount unit contract: the model reports the amount as the image shows it, in the
    // currency's major unit, and `parseImageIntakeModelResponse` scales it into minor units.
    // INTEGER here would silently ask the model to round or to multiply, and either answer is a
    // valid non-negative integer that no schema and no reviewer can tell from a correct one.
    const amountTypes = collectAmountPropertyTypes(IMAGE_INTAKE_RESPONSE_SCHEMA);

    expect(amountTypes.length).toBeGreaterThanOrEqual(4);
    expect(amountTypes.filter(([, type]) => type !== "NUMBER")).toEqual([]);
  });

  it("offers the model no provenance other than read", () => {
    // "assumed" describes a value the SERVER filled in by convention, never something the model can
    // report: it answers null for anything the images do not show. Leaving it in the enum would let
    // a hallucinated provenance render an invented value as a plain reading on the review screen.
    const sourceEnums = collectSourceEnums(IMAGE_INTAKE_RESPONSE_SCHEMA);

    expect(sourceEnums.length).toBeGreaterThanOrEqual(8);
    expect(sourceEnums.filter((values) => values.join(",") !== "read")).toEqual([]);
  });

  it("still declares every branch the draft contract needs, so the guard cannot pass on an empty schema", () => {
    // A schema stripped down to nothing would satisfy the keyword check above trivially. This
    // keeps the guard honest about what it is guarding.
    const properties = IMAGE_INTAKE_RESPONSE_SCHEMA.properties ?? {};

    expect(Object.keys(properties).sort()).toEqual(
      ["currency", "delivery", "groups", "orderDate", "payments", "store", "totalCost", "warnings"].sort(),
    );
  });
});
