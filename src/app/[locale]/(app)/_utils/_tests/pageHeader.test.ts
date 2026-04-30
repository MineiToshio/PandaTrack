import { describe, expect, it } from "vitest";
import { getBreadcrumbs, getPageHeader, getPrivateAppPathSegments, isFirstLevelPrivateRoute } from "../pageHeader";

describe("getPrivateAppPathSegments", () => {
  it("returns segments after locale", () => {
    expect(getPrivateAppPathSegments("/es/dashboard")).toEqual(["dashboard"]);
    expect(getPrivateAppPathSegments("/en/orders/pre-orders")).toEqual(["orders", "pre-orders"]);
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
    expect(isFirstLevelPrivateRoute("/es/orders")).toBe(true);
    expect(isFirstLevelPrivateRoute("/en/deliveries")).toBe(true);
    expect(isFirstLevelPrivateRoute("/es/settings")).toBe(true);
  });

  it("returns false for nested routes", () => {
    expect(isFirstLevelPrivateRoute("/es/orders/pre-orders")).toBe(false);
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
    expect(getBreadcrumbs("/en/orders", "en")).toEqual([]);
  });

  it("returns only parent for nested segment (current page shown as title only)", () => {
    const crumbs = getBreadcrumbs("/es/orders/pre-orders", "es");
    expect(crumbs).toHaveLength(1);
    expect(crumbs[0]).toEqual({ labelKey: "nav.purchases", href: "/es/orders" });
  });

  it("returns only parent for unknown nested segment (e.g. store slug)", () => {
    const crumbs = getBreadcrumbs("/en/stores/some-id", "en");
    expect(crumbs).toHaveLength(1);
    expect(crumbs[0]).toEqual({ labelKey: "nav.stores", href: "/en/stores" });
  });

  it("returns only stores parent for store edit (slug crumb comes from header context)", () => {
    const crumbs = getBreadcrumbs("/en/stores/some-id/edit", "en");
    expect(crumbs).toHaveLength(1);
    expect(crumbs[0]).toEqual({ labelKey: "nav.stores", href: "/en/stores" });
  });
});

describe("getPageHeader", () => {
  it("returns title-only for first-level routes", () => {
    const header = getPageHeader("/es/dashboard", "es");
    expect(header.isFirstLevel).toBe(true);
    expect(header.titleKey).toBe("nav.dashboard");
    expect(header.breadcrumbs).toEqual([]);
  });

  it("returns parent breadcrumbs and current page title for nested routes", () => {
    const header = getPageHeader("/en/orders/pre-orders", "en");
    expect(header.isFirstLevel).toBe(false);
    expect(header.titleKey).toBe("nav.preOrders");
    expect(header.breadcrumbs).toHaveLength(1);
    expect(header.breadcrumbs[0].labelKey).toBe("nav.purchases");
  });

  it("returns stores.newStore title key for create store route", () => {
    const header = getPageHeader("/es/stores/new", "es");
    expect(header.isFirstLevel).toBe(false);
    expect(header.titleKey).toBe("stores.newStore");
    expect(header.breadcrumbs).toHaveLength(1);
    expect(header.breadcrumbs[0].labelKey).toBe("nav.stores");
  });

  it("returns stores.editStore title key for store edit route", () => {
    const header = getPageHeader("/es/stores/some-slug/edit", "es");
    expect(header.isFirstLevel).toBe(false);
    expect(header.titleKey).toBe("stores.editStore");
    expect(header.breadcrumbs).toHaveLength(1);
    expect(header.breadcrumbs[0].labelKey).toBe("nav.stores");
  });
});
