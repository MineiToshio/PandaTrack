import { describe, expect, it } from "vitest";
import { POINT_RULE_KEYS, PROGRESSION_ENTITY_TYPES } from "@/lib/data/progression/pointRules";
import { pointLedgerSourceLabelKey, pointRuleLabelKey, progressionEntityTypeLabelKey } from "../ledgerRowView";

describe("pointRuleLabelKey", () => {
  it("flattens the hyphenated rule key, which next-intl would otherwise read as nesting", () => {
    expect(pointRuleLabelKey("order-first-payment")).toBe("progression.rules.order_first_payment");
  });

  it("leaves a key with no hyphen alone", () => {
    expect(pointRuleLabelKey("orderCreated")).toBe("progression.rules.orderCreated");
  });

  it("covers every rule key the catalogue can store", () => {
    // The mapping is only useful if it answers for the whole vocabulary; a rule added to the
    // catalogue without copy would otherwise surface as a raw token in the tooltip.
    for (const ruleKey of Object.values(POINT_RULE_KEYS)) {
      expect(pointRuleLabelKey(ruleKey)).toMatch(/^progression\.rules\.[a-z_]+$/);
    }
  });
});

describe("progressionEntityTypeLabelKey", () => {
  it("builds the entity-type key for every type the ledger can store", () => {
    for (const entityType of Object.values(PROGRESSION_ENTITY_TYPES)) {
      expect(progressionEntityTypeLabelKey(entityType)).toBe(`progression.entityTypes.${entityType}`);
    }
  });
});

describe("pointLedgerSourceLabelKey", () => {
  it("builds the source key for both stored sources", () => {
    expect(pointLedgerSourceLabelKey("LIVE")).toBe("progression.sources.LIVE");
    expect(pointLedgerSourceLabelKey("BACKFILL")).toBe("progression.sources.BACKFILL");
  });
});
