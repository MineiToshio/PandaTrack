import { describe, expect, it } from "vitest";
import { MAX_IMAGES_PER_SUBMISSION, MAX_IMAGE_FILE_BYTES, MAX_SUBMISSION_TOTAL_BYTES } from "../constants";
import {
  countPhotosWithinSubmissionBudget,
  precheckAttachedPhotos,
  precheckPreparedSegments,
  type IntakeSubmissionFile,
} from "../clientPrecheck";

function filesOfSize(sizes: number[]): IntakeSubmissionFile[] {
  return sizes.map((size) => ({ size }));
}

describe("precheckAttachedPhotos", () => {
  it("accepts a single photo", () => {
    expect(precheckAttachedPhotos(filesOfSize([1024]))).toEqual({ ok: true });
  });

  it("accepts the maximum allowed photo count", () => {
    const files = filesOfSize(Array(MAX_IMAGES_PER_SUBMISSION).fill(1024));
    expect(precheckAttachedPhotos(files)).toEqual({ ok: true });
  });

  it("rejects an empty submission as empty-submission", () => {
    expect(precheckAttachedPhotos([])).toEqual({ ok: false, code: "empty-submission" });
  });

  it("rejects more than the maximum photo count as too-many-images", () => {
    const files = filesOfSize(Array(MAX_IMAGES_PER_SUBMISSION + 1).fill(1024));
    expect(precheckAttachedPhotos(files)).toEqual({ ok: false, code: "too-many-images" });
  });

  // The regression this split exists for. A full-resolution phone screenshot is routinely several
  // megabytes and its owner cannot make it smaller, while preparation reduces it by an order of
  // magnitude before anything is uploaded. Judging the source against the prepared-upload ceiling
  // refused the most ordinary input this feature has, before the step that makes it fit ever ran.
  it("accepts a source photo far heavier than the prepared-upload per-file ceiling", () => {
    const heavyScreenshot = filesOfSize([MAX_IMAGE_FILE_BYTES * 10]);
    expect(precheckAttachedPhotos(heavyScreenshot)).toEqual({ ok: true });
  });

  it("accepts a batch whose combined source bytes exceed the prepared-submission ceiling", () => {
    const perFileSize = MAX_SUBMISSION_TOTAL_BYTES;
    const files = filesOfSize([perFileSize, perFileSize, perFileSize]);
    expect(precheckAttachedPhotos(files)).toEqual({ ok: true });
  });
});

describe("precheckPreparedSegments", () => {
  it.each([
    { name: "a single small segment", sizes: [1024] },
    {
      name: "the maximum allowed segment count, each well under both ceilings",
      sizes: Array(MAX_IMAGES_PER_SUBMISSION).fill(1024),
    },
    { name: "one segment at exactly the per-file ceiling", sizes: [MAX_IMAGE_FILE_BYTES] },
  ])("accepts $name", ({ sizes }) => {
    expect(precheckPreparedSegments(filesOfSize(sizes)).ok).toBe(true);
  });

  it("rejects an empty submission as empty-submission", () => {
    expect(precheckPreparedSegments([])).toEqual({ ok: false, code: "empty-submission", index: null });
  });

  it("rejects more than the maximum segment count as too-many-images", () => {
    const sizes = Array(MAX_IMAGES_PER_SUBMISSION + 1).fill(1024);
    expect(precheckPreparedSegments(filesOfSize(sizes))).toEqual({
      ok: false,
      code: "too-many-images",
      index: null,
    });
  });

  it("rejects a single segment over the per-file byte ceiling as file-too-large, with the offending index", () => {
    const sizes = [1024, MAX_IMAGE_FILE_BYTES + 1];
    expect(precheckPreparedSegments(filesOfSize(sizes))).toEqual({
      ok: false,
      code: "file-too-large",
      index: 1,
    });
  });

  it("rejects a submission whose total bytes exceed the ceiling as submission-too-large", () => {
    const perFileSize = 1.5 * 1024 * 1024;
    const sizes = [perFileSize, perFileSize, perFileSize];
    expect(sizes.reduce((sum, size) => sum + size, 0)).toBeGreaterThan(MAX_SUBMISSION_TOTAL_BYTES);

    expect(precheckPreparedSegments(filesOfSize(sizes))).toEqual({
      ok: false,
      code: "submission-too-large",
      index: null,
    });
  });

  it("checks per-file size before total size, so an individually oversized segment reports file-too-large", () => {
    // Both boundaries are crossed at once; per-file is the more specific, actionable failure and
    // must win, matching the check order in the server-side validator.
    const sizes = [MAX_IMAGE_FILE_BYTES + 1, MAX_IMAGE_FILE_BYTES + 1];
    expect(precheckPreparedSegments(filesOfSize(sizes))).toEqual({
      ok: false,
      code: "file-too-large",
      index: 0,
    });
  });
});

describe("countPhotosWithinSubmissionBudget", () => {
  it("counts every photo when the whole batch fits", () => {
    expect(countPhotosWithinSubmissionBudget([100_000, 100_000, 100_000])).toBe(3);
  });

  it("stops at the last photo that still fits, counting from the first", () => {
    // Four at 1 MB: three fit under the 3.5 MB budget, the fourth does not.
    const oneMegabyte = 1024 * 1024;
    expect(countPhotosWithinSubmissionBudget(Array(4).fill(oneMegabyte))).toBe(3);
  });

  it("counts from the first rather than picking the cheapest photos", () => {
    // A heavy photo early stops the count there, even though skipping it would fit more photos.
    // The batch is one ordered conversation, so the answer has to stay a prefix of it.
    const count = countPhotosWithinSubmissionBudget([MAX_SUBMISSION_TOTAL_BYTES, 1024, 1024]);
    expect(count).toBe(1);
  });

  it("returns zero when even the first photo is over the budget on its own", () => {
    expect(countPhotosWithinSubmissionBudget([MAX_SUBMISSION_TOTAL_BYTES + 1, 1024])).toBe(0);
  });

  it("never suggests more photos than one submission accepts", () => {
    const tiny = Array(MAX_IMAGES_PER_SUBMISSION + 5).fill(1);
    expect(countPhotosWithinSubmissionBudget(tiny)).toBe(MAX_IMAGES_PER_SUBMISSION);
  });
});
