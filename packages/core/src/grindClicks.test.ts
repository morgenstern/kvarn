import { describe, expect, it } from "vitest";
import {
  decodeClickValue,
  encodeClickValue,
  formatClickParts,
  fromAbsoluteIndex,
  indexToValue,
  subDigits,
  subDivisor,
  toAbsoluteIndex,
  totalPositions,
  valueToIndex,
  type ClickScale,
} from "./grindClicks";

// Kingrinder K6: main click 1-4, subclick 0-40 (2 digits needed for 40).
const kingrinder: ClickScale = { mainMin: 1, mainMax: 4, subMin: 0, subMax: 40 };

// A hypothetical grinder needing 3 digits, to prove the encoding isn't
// hardcoded to 2 decimal places.
const wideSub: ClickScale = { mainMin: 1, mainMax: 2, subMin: 0, subMax: 150 };

describe("subDigits / subDivisor", () => {
  it("derives digit width from subMax", () => {
    expect(subDigits(kingrinder)).toBe(2);
    expect(subDivisor(kingrinder)).toBe(100);
    expect(subDigits(wideSub)).toBe(3);
    expect(subDivisor(wideSub)).toBe(1000);
  });
});

describe("encodeClickValue / decodeClickValue", () => {
  it("encodes main+sub into the documented 1,25-style float (2-digit scale)", () => {
    expect(encodeClickValue(1, 25, kingrinder)).toBe(1.25);
    expect(encodeClickValue(1, 5, kingrinder)).toBe(1.05);
    expect(encodeClickValue(4, 40, kingrinder)).toBe(4.4);
  });

  it("decodes back to the exact main+sub pair", () => {
    expect(decodeClickValue(1.25, kingrinder)).toEqual({ mainClick: 1, subClick: 25 });
    expect(decodeClickValue(1.05, kingrinder)).toEqual({ mainClick: 1, subClick: 5 });
    expect(decodeClickValue(4.4, kingrinder)).toEqual({ mainClick: 4, subClick: 40 });
  });

  it("uses 3 decimal digits for a subMax above 99, not a fixed 2", () => {
    expect(encodeClickValue(2, 5, wideSub)).toBe(2.005);
    expect(decodeClickValue(2.005, wideSub)).toEqual({ mainClick: 2, subClick: 5 });
    expect(encodeClickValue(1, 99, wideSub)).toBe(1.099);
    expect(decodeClickValue(1.099, wideSub)).toEqual({ mainClick: 1, subClick: 99 });
  });

  it("never leaves binary floating-point noise in the encoded value", () => {
    expect(encodeClickValue(1, 7, kingrinder).toString()).not.toContain("00000");
    expect(encodeClickValue(3, 33, kingrinder).toString()).not.toContain("00000");
  });
});

describe("totalPositions", () => {
  it("counts every valid (main, sub) pair across the whole scale", () => {
    expect(totalPositions(kingrinder)).toBe(164);
  });
});

describe("toAbsoluteIndex / fromAbsoluteIndex", () => {
  it("is 0 at the very first position", () => {
    expect(toAbsoluteIndex(1, 0, kingrinder)).toBe(0);
    expect(fromAbsoluteIndex(0, kingrinder)).toEqual({ mainClick: 1, subClick: 0 });
  });

  it("rolls over into the next main click instead of an out-of-range subclick", () => {
    expect(toAbsoluteIndex(1, 40, kingrinder)).toBe(40);
    expect(fromAbsoluteIndex(41, kingrinder)).toEqual({ mainClick: 2, subClick: 0 });
    expect(toAbsoluteIndex(2, 0, kingrinder)).toBe(41);
  });

  it("is 163 at the very last position", () => {
    expect(totalPositions(kingrinder) - 1).toBe(163);
    expect(fromAbsoluteIndex(163, kingrinder)).toEqual({ mainClick: 4, subClick: 40 });
    expect(toAbsoluteIndex(4, 40, kingrinder)).toBe(163);
  });
});

describe("valueToIndex / indexToValue", () => {
  it("round-trips through the encoded float and the absolute index", () => {
    expect(valueToIndex(1.25, kingrinder)).toBe(25);
    expect(indexToValue(25, kingrinder)).toBe(1.25);
    expect(indexToValue(valueToIndex(2.01, kingrinder), kingrinder)).toBe(2.01);
  });
});

describe("formatClickParts", () => {
  it("zero-pads the subclick to the scale's digit width", () => {
    expect(formatClickParts(1.25, kingrinder)).toEqual({ mainClick: 1, subClick: "25" });
    expect(formatClickParts(1.05, kingrinder)).toEqual({ mainClick: 1, subClick: "05" });
    expect(formatClickParts(2.005, wideSub)).toEqual({ mainClick: 2, subClick: "005" });
  });
});
