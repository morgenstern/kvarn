import { describe, expect, it } from "vitest";
import { deriveBrewMethod } from "./brewMethod";

describe("deriveBrewMethod", () => {
  it("prefers the machine's methodHint when set, regardless of bean type", () => {
    // filter bean, but the machine hint (espresso) wins
    expect(deriveBrewMethod("filter", "espresso")).toBe("espresso");
    // espresso bean, but the machine hint (aeropress) wins — hint always
    // wins, not just when it happens to agree with the bean type
    expect(deriveBrewMethod("espresso", "aeropress")).toBe("aeropress");
    expect(deriveBrewMethod(null, "moka")).toBe("moka");
  });

  it("falls back to bean type when the machine has no methodHint", () => {
    expect(deriveBrewMethod("espresso", null)).toBe("espresso");
    expect(deriveBrewMethod("espresso", undefined)).toBe("espresso");
    expect(deriveBrewMethod("filter", null)).toBe("v60");
  });

  it("defaults to espresso when nothing is known", () => {
    expect(deriveBrewMethod(null, null)).toBe("espresso");
    expect(deriveBrewMethod(undefined, undefined)).toBe("espresso");
  });
});
