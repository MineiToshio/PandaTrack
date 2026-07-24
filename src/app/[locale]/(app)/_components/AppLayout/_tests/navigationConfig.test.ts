import { describe, expect, it } from "vitest";
import {
  getActiveAdminNavItemId,
  getActiveNavItem,
  getAdminNavItems,
  getPrivateAppNavItems,
  getPrivateAppPathSegment,
} from "../navigationConfig";

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

describe("getAdminNavItems", () => {
  it("returns the grouped Administración section items in order", () => {
    const items = getAdminNavItems();
    expect(items.map((i) => i.id)).toEqual(["moderation", "audit"]);
  });

  it("builds locale-prefixed hrefs for the admin landing and audit routes", () => {
    const items = getAdminNavItems();
    expect(items[0].href("es")).toBe("/es/admin");
    expect(items[1].href("en")).toBe("/en/admin/audit");
  });

  it("resolves labels against the admin namespace", () => {
    const items = getAdminNavItems();
    expect(items.map((i) => i.labelKey)).toEqual(["nav.moderation", "nav.audit"]);
  });
});

describe("getActiveAdminNavItemId", () => {
  it("matches the moderation landing for the admin root", () => {
    expect(getActiveAdminNavItemId("/es/admin")).toBe("moderation");
    expect(getActiveAdminNavItemId("/en/admin")).toBe("moderation");
  });

  it("matches the audit entry for the nested audit route", () => {
    expect(getActiveAdminNavItemId("/es/admin/audit")).toBe("audit");
    expect(getActiveAdminNavItemId("/en/admin/audit")).toBe("audit");
  });

  it("returns undefined for non-admin routes so no collector item is displaced", () => {
    expect(getActiveAdminNavItemId("/es/dashboard")).toBeUndefined();
    expect(getActiveAdminNavItemId("/en/stores")).toBeUndefined();
    expect(getActiveAdminNavItemId("/es")).toBeUndefined();
    expect(getActiveAdminNavItemId("")).toBeUndefined();
  });
});
