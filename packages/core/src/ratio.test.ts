import { describe, expect, it } from "vitest";
import { computeBeanAgeDays, computeFlowRate, computeRatio } from "./ratio";

describe("computeRatio", () => {
  it("computes a standard espresso ratio", () => {
    expect(computeRatio({ doseG: 18, yieldG: 36 })).toBe(2);
  });

  it("rounds to one decimal", () => {
    expect(computeRatio({ doseG: 15, yieldG: 32 })).toBe(2.1);
  });

  it("throws for non-positive dose", () => {
    expect(() => computeRatio({ doseG: 0, yieldG: 36 })).toThrow();
  });
});

describe("computeFlowRate", () => {
  it("computes g/s", () => {
    expect(computeFlowRate(36, 28)).toBe(1.3);
  });

  it("returns 0 for zero time", () => {
    expect(computeFlowRate(36, 0)).toBe(0);
  });
});

describe("computeBeanAgeDays", () => {
  it("computes whole days between roast and brew", () => {
    const roast = new Date("2026-06-01T00:00:00Z");
    const brew = new Date("2026-06-08T00:00:00Z");
    expect(computeBeanAgeDays(roast, brew)).toBe(7);
  });

  it("never returns negative age", () => {
    const roast = new Date("2026-06-10T00:00:00Z");
    const brew = new Date("2026-06-01T00:00:00Z");
    expect(computeBeanAgeDays(roast, brew)).toBe(0);
  });
});
