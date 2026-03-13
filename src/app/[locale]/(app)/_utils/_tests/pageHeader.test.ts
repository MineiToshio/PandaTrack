import { describe, expect, it } from "vitest";
import { getBreadcrumbs, getPageHeader, getPrivateAppPathSegments, isFirstLevelPrivateRoute } from "../pageHeader";

describe("getPrivateAppPathSegments", () => {
  it("returns segments after locale", () => {
    expect(getPrivateAppPathSegments("/es/dashboard")).toEqual(["dashboard"]);
    expect(getPrivateAppPathSegments("/en/purchases/pre-orders")).toEqual(["purchases", "pre-orders"]);
  });

  it("returns empty when pathname has no segment after locale", () => {
    expect(getPrivateAppPathSegments("/es")).toEqual([]);
    expect(getPrivateAppPathSegments("/")).toEqual([]);
  });
});

describe("isFirstLevelPrivateRoute", () => {
  it("returns true for locale + single primary segment", () => {
    expect(isFirstLevelPrivateRoute("/es/dashboard")).toBe(true);
    expect(isFirstLevelPrivateRoute("/en/stores")).toBe(true);
    expect(isFirstLevelPrivateRoute("/es/purchases")).toBe(true);
    expect(isFirstLevelPrivateRoute("/en/shipments")).toBe(true);
    expect(isFirstLevelPrivateRoute("/es/settings")).toBe(true);
  });

  it("returns false for nested routes", () => {
    expect(isFirstLevelPrivateRoute("/es/purchases/pre-orders")).toBe(false);
    expect(isFirstLevelPrivateRoute("/en/stores/foo")).toBe(false);
  });

  it("returns false for unknown or empty segment", () => {
    expect(isFirstLevelPrivateRoute("/es")).toBe(false);
    expect(isFirstLevelPrivateRoute("/es/unknown")).toBe(false);
  });
});

describe("getBreadcrumbs", () => {
  it("returns empty for first-level routes", () => {
    expect(getBreadcrumbs("/es/dashboard", "es")).toEqual([]);
    expect(getBreadcrumbs("/en/purchases", "en")).toEqual([]);
  });

  it("returns parent and current for known nested segment (purchases > pre-orders)", () => {
    const crumbs = getBreadcrumbs("/es/purchases/pre-orders", "es");
    expect(crumbs).toHaveLength(2);
    expect(crumbs[0]).toEqual({ labelKey: "nav.purchases", href: "/es/purchases" });
    expect(crumbs[1]).toEqual({ labelKey: "nav.preOrders", href: "/es/purchases/pre-orders" });
  });

  it("uses breadcrumb.detail for unknown nested segment", () => {
    const crumbs = getBreadcrumbs("/en/stores/some-id", "en");
    expect(crumbs).toHaveLength(2);
    expect(crumbs[0]).toEqual({ labelKey: "nav.stores", href: "/en/stores" });
    expect(crumbs[1].labelKey).toBe("breadcrumb.detail");
    expect(crumbs[1].href).toBe("/en/stores/some-id");
  });
});

describe("getPageHeader", () => {
  it("returns title-only for first-level routes", () => {
    const header = getPageHeader("/es/dashboard", "es");
    expect(header.isFirstLevel).toBe(true);
    expect(header.titleKey).toBe("nav.dashboard");
    expect(header.breadcrumbs).toEqual([]);
  });

  it("returns breadcrumbs and current title for nested routes", () => {
    const header = getPageHeader("/en/purchases/pre-orders", "en");
    expect(header.isFirstLevel).toBe(false);
    expect(header.titleKey).toBe("nav.preOrders");
    expect(header.breadcrumbs).toHaveLength(2);
    expect(header.breadcrumbs[0].labelKey).toBe("nav.purchases");
    expect(header.breadcrumbs[1].labelKey).toBe("nav.preOrders");
  });
});
