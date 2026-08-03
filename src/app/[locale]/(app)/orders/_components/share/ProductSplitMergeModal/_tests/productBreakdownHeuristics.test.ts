import { describe, expect, it } from "vitest";
import { deduceRangeParts } from "../productBreakdownHeuristics";


describe("deduceRangeParts", () => {
  it("deduces names from a pack-prefixed closed range, stripping the pack word", () => {
    expect(deduceRangeParts("Pack One Piece 1 al 3")).toEqual(["One Piece 1", "One Piece 2", "One Piece 3"]);
  });

  it("deduces names from a hyphen range with no pack prefix", () => {
    expect(deduceRangeParts("Tokyo Revengers 1-2")).toEqual(["Tokyo Revengers 1", "Tokyo Revengers 2"]);
  });

  it("returns null for an open range", () => {
    expect(deduceRangeParts("Marvel Ultimate del 42 en adelante")).toBeNull();
  });

  it("returns null for a name with no numeric range", () => {
    expect(deduceRangeParts("Pack chase de Gojo")).toBeNull();
  });

  it("returns null for an inverted range (end before start)", () => {
    expect(deduceRangeParts("Volumen 5 al 2")).toBeNull();
  });

  it("returns null for a single-number range (start equals end)", () => {
    expect(deduceRangeParts("Volumen 3 al 3")).toBeNull();
  });
});
