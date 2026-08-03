import { describe, expect, it } from "vitest";
import { isFabEligibleRoute } from "../fabRouteGate";

describe("isFabEligibleRoute", () => {
  it("is eligible on the Dashboard", () => {
    expect(isFabEligibleRoute("/en/dashboard", "en")).toBe(true);
  });

  it("is eligible on the Orders list", () => {
    expect(isFabEligibleRoute("/es/orders", "es")).toBe(true);
    expect(isFabEligibleRoute("/es/orders/", "es")).toBe(true);
  });

  it("is not eligible on order detail", () => {
    expect(isFabEligibleRoute("/en/orders/ord-1", "en")).toBe(false);
  });

  it("is not eligible inside a creation wizard", () => {
    expect(isFabEligibleRoute("/en/orders/new", "en")).toBe(false);
    expect(isFabEligibleRoute("/en/orders/new/image", "en")).toBe(false);
  });

  it("is not eligible on Stores or Deliveries", () => {
    expect(isFabEligibleRoute("/en/stores", "en")).toBe(false);
    expect(isFabEligibleRoute("/en/deliveries", "en")).toBe(false);
  });

  it("is not eligible on delivery detail", () => {
    expect(isFabEligibleRoute("/en/deliveries/dlv-1", "en")).toBe(false);
  });

  it("does not match a route from a different locale", () => {
    expect(isFabEligibleRoute("/en/orders", "es")).toBe(false);
  });
});
