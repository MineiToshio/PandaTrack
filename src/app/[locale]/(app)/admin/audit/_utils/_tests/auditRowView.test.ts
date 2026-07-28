import { describe, expect, it } from "vitest";
import { AUDIT_ACTION_KEYS, AUDIT_TARGET_TYPE_KEYS } from "@/lib/data/admin/adminAuditVocabulary";
import { auditActionTitleKey, auditTargetTypeLabelKey } from "../auditRowView";

describe("auditTargetTypeLabelKey", () => {
  it("maps each target type to its admin namespace label key", () => {
    expect(auditTargetTypeLabelKey("store")).toBe("audit.targetType.store");
    expect(auditTargetTypeLabelKey("report")).toBe("audit.targetType.report");
    expect(auditTargetTypeLabelKey("changeRequest")).toBe("audit.targetType.changeRequest");
    expect(auditTargetTypeLabelKey("productType")).toBe("audit.targetType.productType");
  });

  it("produces a key for every target type in the vocabulary", () => {
    for (const targetType of AUDIT_TARGET_TYPE_KEYS) {
      expect(auditTargetTypeLabelKey(targetType)).toBe(`audit.targetType.${targetType}`);
    }
  });
});

describe("auditActionTitleKey", () => {
  it("flattens the dotted action key to an underscore lookup key", () => {
    expect(auditActionTitleKey("store.remove")).toBe("audit.action.store_remove");
    expect(auditActionTitleKey("report.resolve")).toBe("audit.action.report_resolve");
    expect(auditActionTitleKey("changeRequest.apply")).toBe("audit.action.changeRequest_apply");
    expect(auditActionTitleKey("productType.approve")).toBe("audit.action.productType_approve");
  });

  it("produces a dot-free key for every action in the vocabulary", () => {
    for (const action of AUDIT_ACTION_KEYS) {
      const key = auditActionTitleKey(action);
      expect(key.startsWith("audit.action.")).toBe(true);
      expect(key.slice("audit.action.".length)).not.toContain(".");
    }
  });
});
