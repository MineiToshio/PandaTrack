import { describe, expect, it } from "vitest";
import { foldSearchText } from "../foldSearchText";

describe("foldSearchText", () => {
  it("folds case", () => {
    expect(foldSearchText("México")).toBe(foldSearchText("mexico"));
  });

  it("strips Latin diacritics so query matches translated labels", () => {
    expect(foldSearchText("Perú")).toBe("peru");
    expect(foldSearchText("méxico")).toBe("mexico");
    expect(foldSearchText(" España ")).toBe("espana");
  });

  it("leaves ASCII country codes unchanged aside from case", () => {
    expect(foldSearchText("MX")).toBe("mx");
    expect(foldSearchText("pe")).toBe("pe");
  });
});
