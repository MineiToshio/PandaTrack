import { describe, expect, it } from "vitest";
import { getActiveNavItem, getPrivateAppNavItems, getPrivateAppPathSegment } from "../navigationConfig";

describe("getPrivateAppPathSegment", () => {
  it("returns the second segment when it is a known private app segment", () => {
    expect(getPrivateAppPathSegment("/es/dashboard")).toBe("dashboard");
    expect(getPrivateAppPathSegment("/en/stores")).toBe("stores");
    expect(getPrivateAppPathSegment("/es/orders")).toBe("orders");
    expect(getPrivateAppPathSegment("/en/deliveries")).toBe("deliveries");
    expect(getPrivateAppPathSegment("/es/settings")).toBe("settings");
  });

  it("returns undefined when pathname has no second segment", () => {
    expect(getPrivateAppPathSegment("/es")).toBeUndefined();
    expect(getPrivateAppPathSegment("/")).toBeUndefined();
    expect(getPrivateAppPathSegment("")).toBeUndefined();
  });

  it("returns undefined when second segment is not a known private app segment", () => {
    expect(getPrivateAppPathSegment("/es/unknown")).toBeUndefined();
    expect(getPrivateAppPathSegment("/en/foo/bar")).toBeUndefined();
  });
});

describe("getActiveNavItem", () => {
  it("returns the nav item matching the pathname segment", () => {
    expect(getActiveNavItem("/es/dashboard").id).toBe("dashboard");
    expect(getActiveNavItem("/en/stores").id).toBe("stores");
    expect(getActiveNavItem("/es/settings").id).toBe("settings");
  });

  it("returns dashboard (first item) when pathname does not match any segment", () => {
    expect(getActiveNavItem("/es").id).toBe("dashboard");
    expect(getActiveNavItem("/es/unknown").id).toBe("dashboard");
    expect(getActiveNavItem("").id).toBe("dashboard");
  });
});

describe("getPrivateAppNavItems", () => {
  it("returns the collector primary nav items in order without settings", () => {
    const items = getPrivateAppNavItems();
    expect(items).toHaveLength(4);
    expect(items.map((i) => i.id)).toEqual(["dashboard", "stores", "orders", "deliveries"]);
  });

  it("returns items with href that include locale and route", () => {
    const items = getPrivateAppNavItems();
    expect(items[0].href("es")).toBe("/es/dashboard");
    expect(items[1].href("en")).toBe("/en/stores");
  });
});
