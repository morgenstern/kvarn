import { describe, expect, it } from "vitest";
import { freshnessPct } from "./freshness";

describe("freshnessPct", () => {
  it("is 0 before roasting (negative age)", () => {
    expect(freshnessPct(-1)).toBe(0);
  });

  it("is 100 during the peak window", () => {
    expect(freshnessPct(0)).toBe(100);
    expect(freshnessPct(4)).toBe(100);
    expect(freshnessPct(21)).toBe(100);
  });

  it("decays after the peak window", () => {
    expect(freshnessPct(33)).toBe(50);
  });

  it("never goes below 0", () => {
    expect(freshnessPct(1000)).toBe(0);
  });
});
