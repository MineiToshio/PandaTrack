import { describe, expect, it } from "vitest";
import {
  duplicateCandidatesQuerySchema,
  duplicateCandidatesSubmitSchema,
} from "../duplicateCandidatesSchema";

describe("duplicateCandidatesQuerySchema", () => {
  it("accepts a valid name query and limit", () => {
    const result = duplicateCandidatesQuerySchema.safeParse({ nameQuery: "Panda Store", limit: 5 });
    expect(result.success).toBe(true);
  });

  it("trims the name query", () => {
    const result = duplicateCandidatesQuerySchema.safeParse({ nameQuery: "  Panda  ", limit: 5 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.nameQuery).toBe("Panda");
  });

  it("rejects an empty name query", () => {
    expect(duplicateCandidatesQuerySchema.safeParse({ nameQuery: "   ", limit: 5 }).success).toBe(false);
  });

  it("rejects a name query over 200 characters", () => {
    const result = duplicateCandidatesQuerySchema.safeParse({ nameQuery: "a".repeat(201), limit: 5 });
    expect(result.success).toBe(false);
  });

  it("rejects a limit outside the 1-20 range", () => {
    expect(duplicateCandidatesQuerySchema.safeParse({ nameQuery: "Panda", limit: 0 }).success).toBe(false);
    expect(duplicateCandidatesQuerySchema.safeParse({ nameQuery: "Panda", limit: 21 }).success).toBe(false);
  });

  it("rejects a non-integer limit", () => {
    expect(duplicateCandidatesQuerySchema.safeParse({ nameQuery: "Panda", limit: 5.5 }).success).toBe(false);
  });
});

describe("duplicateCandidatesSubmitSchema", () => {
  it("accepts a valid name query and two-letter country code", () => {
    const result = duplicateCandidatesSubmitSchema.safeParse({ nameQuery: "Panda Store", countryCode: "ES" });
    expect(result.success).toBe(true);
  });

  it("rejects a country code that is not two characters", () => {
    expect(duplicateCandidatesSubmitSchema.safeParse({ nameQuery: "Panda", countryCode: "ESP" }).success).toBe(false);
    expect(duplicateCandidatesSubmitSchema.safeParse({ nameQuery: "Panda", countryCode: "E" }).success).toBe(false);
  });

  it("rejects an empty name query", () => {
    expect(duplicateCandidatesSubmitSchema.safeParse({ nameQuery: "", countryCode: "ES" }).success).toBe(false);
  });
});
