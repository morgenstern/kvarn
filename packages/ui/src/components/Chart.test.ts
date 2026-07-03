import { describe, expect, it } from "vitest";
import { computeDomain } from "./Chart";

describe("computeDomain", () => {
  it("uses an explicit domain verbatim", () => {
    expect(computeDomain([5, 10, 15], [0, 100])).toEqual([0, 100]);
  });

  it("derives min/max from real values without blending in synthetic bounds", () => {
    // Regression test: large timestamps used to get corrupted to [0, timestamp]
    // because the old code did Math.min(...values, 0).
    const timestamps = [1751500000000, 1751600000000];
    expect(computeDomain(timestamps)).toEqual([1751500000000, 1751600000000]);
  });

  it("falls back to [0, 1] only when there is no data at all", () => {
    expect(computeDomain([])).toEqual([0, 1]);
  });

  it("handles a single value (min === max)", () => {
    expect(computeDomain([42])).toEqual([42, 42]);
  });
});
