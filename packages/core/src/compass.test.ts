import { describe, expect, it } from "vitest";
import { nextGrindSuggestion, type GrindScale } from "./compass";

// Niche Zero-style scale: 0 = finest, 30 = coarsest, step 0.5, lower = finer.
const nicheScale: GrindScale = { min: 0, max: 30, step: 0.5, unit: "clicks", finerDirection: -1 };

describe("nextGrindSuggestion — golden tests", () => {
  it("no history -> espresso method default (25% into scale)", () => {
    const result = nextGrindSuggestion({
      method: "espresso",
      grindScale: nicheScale,
      lastBrew: null,
    });
    expect(result.grindSetting).toBe(7.5);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons[0]?.factor).toBe("no_history");
  });

  it("no history -> french press default (85% into scale)", () => {
    const result = nextGrindSuggestion({
      method: "frenchpress",
      grindScale: nicheScale,
      lastBrew: null,
    });
    expect(result.grindSetting).toBe(25.5);
  });

  it("sour + too fast espresso -> finer", () => {
    const result = nextGrindSuggestion({
      method: "espresso",
      grindScale: nicheScale,
      lastBrew: { grindSetting: 10, timeTotalS: 20, balance: -3 },
    });
    // balance -3 -> magnitude 2 finer; time 20s < 25s min -> +1 finer; total 3 steps finer
    // finerDirection -1 -> delta = 3 * -1 * 0.5 = -1.5
    expect(result.grindSetting).toBe(8.5);
    expect(result.reasons.map((r) => r.factor)).toEqual(["balance", "time_too_fast"]);
  });

  it("bitter + too slow espresso -> coarser", () => {
    const result = nextGrindSuggestion({
      method: "espresso",
      grindScale: nicheScale,
      lastBrew: { grindSetting: 10, timeTotalS: 40, balance: 4 },
    });
    // balance +4 -> magnitude 2 coarser; time 40s > 32s max -> 1 coarser; total 3 steps coarser
    // delta = -3 * -1 * 0.5 = +1.5
    expect(result.grindSetting).toBe(11.5);
  });

  it("balanced brew within time window -> no correction", () => {
    const result = nextGrindSuggestion({
      method: "espresso",
      grindScale: nicheScale,
      lastBrew: { grindSetting: 10, timeTotalS: 28, balance: 0 },
    });
    expect(result.grindSetting).toBe(10);
    expect(result.reasons).toHaveLength(0);
  });

  it("bean age 4-8 days nudges finer even with no other signal", () => {
    const result = nextGrindSuggestion({
      method: "espresso",
      grindScale: nicheScale,
      lastBrew: { grindSetting: 10, timeTotalS: 28, balance: 0 },
      beanAgeDays: 6,
    });
    // fractionalFiner 0.1 -> rounds to nearest step (0.5) after applying to grind: delta = 0.1*-1*0.5=-0.05 -> rounds to 10
    expect(result.grindSetting).toBe(10);
    expect(result.reasons[0]?.factor).toBe("bean_age");
  });

  it("large positive humidity delta nudges coarser", () => {
    const result = nextGrindSuggestion({
      method: "espresso",
      grindScale: nicheScale,
      lastBrew: { grindSetting: 10, timeTotalS: 28, balance: 0 },
      humidityDeltaPct: 20,
    });
    expect(result.reasons[0]?.factor).toBe("humidity");
    expect(result.reasons[0]?.effect).toContain("gröber");
  });

  it("stepless scale (0.1 step) never produces floating-point noise in the result", () => {
    const steplessScale: GrindScale = { min: 0, max: 10, step: 0.1, unit: "turns", finerDirection: -1 };
    const result = nextGrindSuggestion({
      method: "espresso",
      grindScale: steplessScale,
      lastBrew: { grindSetting: 2.5, timeTotalS: 20, balance: 0 },
      beanAgeDays: 6,
    });
    // Regression test: 2.5 + (-0.1 finer steps) used to yield 2.4000000000000004.
    expect(result.grindSetting.toString()).not.toContain("00000");
    expect(result.grindSetting).toBe(2.4);
  });

  it("clamps to scale bounds", () => {
    const result = nextGrindSuggestion({
      method: "espresso",
      grindScale: nicheScale,
      lastBrew: { grindSetting: 0.5, timeTotalS: 10, balance: -5 },
    });
    expect(result.grindSetting).toBeGreaterThanOrEqual(nicheScale.min);
  });

  it("subclicks enabled: moves within the same main click, no rollover needed", () => {
    const kingrinder: GrindScale = {
      min: 1, max: 4.4, step: 0.01, unit: "clicks", finerDirection: -1,
      subclicksEnabled: true, mainMin: 1, mainMax: 4, subMin: 0, subMax: 40,
    };
    const result = nextGrindSuggestion({
      method: "espresso",
      grindScale: kingrinder,
      // sour (balance -3 -> 2 steps finer) + too fast (20s < 25s min -> 1 step finer) = 3 steps finer
      lastBrew: { grindSetting: 1.25, timeTotalS: 20, balance: -3 },
    });
    // finerDirection -1 -> index moves -3 from index 25 (main 1, sub 25) -> index 22 -> main 1, sub 22
    expect(result.grindSetting).toBe(1.22);
  });

  it("subclicks enabled: rolls over into the next main click instead of an invalid position", () => {
    const kingrinder: GrindScale = {
      min: 1, max: 4.4, step: 0.01, unit: "clicks", finerDirection: -1,
      subclicksEnabled: true, mainMin: 1, mainMax: 4, subMin: 0, subMax: 40,
    };
    const result = nextGrindSuggestion({
      method: "espresso",
      grindScale: kingrinder,
      // bitter (balance +4 -> 2 steps coarser) + too slow (40s > 32s max -> 1 step coarser) = 3 steps coarser
      lastBrew: { grindSetting: 1.39, timeTotalS: 40, balance: 4 },
    });
    // finerDirection -1, coarser -> index moves +3 from index 39 (main 1, sub 39) -> index 42
    // -> rolls past the end of main click 1 (indices 0-40) into main click 2, sub 1 — not "main 1, sub 42" (invalid).
    expect(result.grindSetting).toBe(2.01);
  });

  it("subclicks enabled: clamps at the top of the whole scale instead of exceeding it", () => {
    const kingrinder: GrindScale = {
      min: 1, max: 4.4, step: 0.01, unit: "clicks", finerDirection: -1,
      subclicksEnabled: true, mainMin: 1, mainMax: 4, subMin: 0, subMax: 40,
    };
    const result = nextGrindSuggestion({
      method: "espresso",
      grindScale: kingrinder,
      // same 3-steps-coarser signal as above, but starting 3 positions from the very top already
      lastBrew: { grindSetting: 4.38, timeTotalS: 40, balance: 4 },
    });
    // index 161 (main 4, sub 38) + 3 = 164, but the last valid index is 163 (main 4, sub 40) -> clamp
    expect(result.grindSetting).toBe(4.4);
  });
});
