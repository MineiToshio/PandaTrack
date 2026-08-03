import { describe, expect, it } from "vitest";
import { MAX_IMAGES_PER_SUBMISSION, MAX_IMAGE_FILE_BYTES, MAX_SUBMISSION_TOTAL_BYTES } from "../constants";
import { precheckIntakeSubmission, type IntakeSubmissionFile } from "../clientPrecheck";

function filesOfSize(sizes: number[]): IntakeSubmissionFile[] {
  return sizes.map((size) => ({ size }));
}

describe("precheckIntakeSubmission", () => {
  it.each([
    { name: "a single small file", sizes: [1024] },
    {
      name: "the maximum allowed image count, each well under both ceilings",
      sizes: Array(MAX_IMAGES_PER_SUBMISSION).fill(1024),
    },
    { name: "one file at exactly the per-file ceiling", sizes: [MAX_IMAGE_FILE_BYTES] },
  ])("accepts $name", ({ sizes }) => {
    const result = precheckIntakeSubmission(filesOfSize(sizes));
    expect(result.ok).toBe(true);
  });

  it("rejects an empty submission as empty-submission", () => {
    const result = precheckIntakeSubmission([]);
    expect(result).toEqual({ ok: false, code: "empty-submission", index: null });
  });

  it("rejects a submission with more than the maximum image count as too-many-images", () => {
    const sizes = Array(MAX_IMAGES_PER_SUBMISSION + 1).fill(1024);
    const result = precheckIntakeSubmission(filesOfSize(sizes));
    expect(result).toEqual({ ok: false, code: "too-many-images", index: null });
  });

  it("rejects a single file over the per-file byte ceiling as file-too-large, with the offending index", () => {
    const sizes = [1024, MAX_IMAGE_FILE_BYTES + 1];
    const result = precheckIntakeSubmission(filesOfSize(sizes));
    expect(result).toEqual({ ok: false, code: "file-too-large", index: 1 });
  });

  it("rejects a submission whose total bytes exceed the ceiling as submission-too-large", () => {
    const perFileSize = 1.5 * 1024 * 1024;
    const sizes = [perFileSize, perFileSize, perFileSize];
    expect(sizes.reduce((sum, size) => sum + size, 0)).toBeGreaterThan(MAX_SUBMISSION_TOTAL_BYTES);

    const result = precheckIntakeSubmission(filesOfSize(sizes));
    expect(result).toEqual({ ok: false, code: "submission-too-large", index: null });
  });

  it("checks per-file size before total size, so an individually oversized file reports file-too-large", () => {
    // Both boundaries are crossed at once; per-file is the more specific, actionable failure and
    // must win, matching the check order in the server-side validator.
    const sizes = [MAX_IMAGE_FILE_BYTES + 1, MAX_IMAGE_FILE_BYTES + 1];
    const result = precheckIntakeSubmission(filesOfSize(sizes));
    expect(result).toEqual({ ok: false, code: "file-too-large", index: 0 });
  });
});
