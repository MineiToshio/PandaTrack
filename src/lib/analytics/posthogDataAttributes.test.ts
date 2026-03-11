import { describe, expect, it } from "vitest";
import { getPosthogDataAttributes, serializePosthogProps } from "@/lib/analytics/posthogDataAttributes";

describe("serializePosthogProps", () => {
  it("returns undefined when no props are provided", () => {
    expect(serializePosthogProps(undefined)).toBeUndefined();
  });

  it("serializes props into JSON", () => {
    expect(serializePosthogProps({ source: "landing", count: 2 })).toBe('{"source":"landing","count":2}');
  });
});

describe("getPosthogDataAttributes", () => {
  it("returns an empty object when the event is missing", () => {
    expect(getPosthogDataAttributes(undefined, { source: "landing" })).toEqual({});
  });

  it("returns both event and serialized props when available", () => {
    expect(getPosthogDataAttributes("waitlist_submitted", { source: "landing" })).toEqual({
      "data-ph-event": "waitlist_submitted",
      "data-ph-props": '{"source":"landing"}',
    });
  });
});
