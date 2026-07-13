# Grind Main-Click/Subclick Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a grinder's grind scale be modeled as two dials — a coarse "main click" and a fine "subclick" within it (e.g. Kingrinder K6: main 1–4, sub 0–40) — stored as one float (`1.25` = main 1, sub 25), editable via a Settings toggle, steppable as a single odometer-style control on the brew screen, and correctly rollover-aware in Compass suggestions.

**Architecture:** A new pure-function module in `packages/core` (`grindClicks.ts`) converts between three representations of a click position: `{mainClick, subClick}`, the single encoded float stored in `grindSetting`, and an "absolute index" (0-based, uniform step of 1) used for all step/clamp arithmetic. Both the brewing-screen stepper and Compass's suggestion math operate in absolute-index space and only convert to the encoded float at the storage/display boundary — this is what makes rollover between main clicks fall out for free instead of needing boundary-case logic. No new UI component: the existing `ParamStepper` (which already supports a `formatValue` display override) is reused as-is by feeding it the absolute index.

**Tech Stack:** TypeScript, Vitest (unit tests in `packages/core`), Drizzle (JSON column, no SQL migration needed), Dexie (local IndexedDB, one version bump), React (existing components, no new ones).

**Spec:** `docs/superpowers/specs/2026-07-05-grind-main-subclicks-design.md`

---

## Task 1: Core click/index conversion helpers

**Files:**
- Create: `packages/core/src/grindClicks.ts`
- Test: `packages/core/src/grindClicks.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/core/src/grindClicks.test.ts`:

```typescript
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
    // Regression-style check, same convention as compass.test.ts's stepless-scale test.
    expect(encodeClickValue(1, 7, kingrinder).toString()).not.toContain("00000");
    expect(encodeClickValue(3, 33, kingrinder).toString()).not.toContain("00000");
  });
});

describe("totalPositions", () => {
  it("counts every valid (main, sub) pair across the whole scale", () => {
    // 4 main clicks x 41 subclick positions each (0..40 inclusive) = 164
    expect(totalPositions(kingrinder)).toBe(164);
  });
});

describe("toAbsoluteIndex / fromAbsoluteIndex", () => {
  it("is 0 at the very first position", () => {
    expect(toAbsoluteIndex(1, 0, kingrinder)).toBe(0);
    expect(fromAbsoluteIndex(0, kingrinder)).toEqual({ mainClick: 1, subClick: 0 });
  });

  it("rolls over into the next main click instead of an out-of-range subclick", () => {
    // Last position of main click 1 is sub 40 -> index 40.
    expect(toAbsoluteIndex(1, 40, kingrinder)).toBe(40);
    // The very next index rolls to main click 2, sub 0 - not "main 1, sub 41" (invalid).
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @kvarn/core test`
Expected: FAIL — `Cannot find module './grindClicks'` (the file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/grindClicks.ts`:

```typescript
/**
 * Conversions between the three representations of a two-dial "main
 * click + subclick" grind position (e.g. Kingrinder K6: main 1-4, sub
 * 0-40) — see docs/superpowers/specs/2026-07-05-grind-main-subclicks-design.md.
 *
 * - {mainClick, subClick}: what a person actually sets on the grinder.
 * - encoded float: what's stored in brew.grindSetting, e.g. 1.25.
 * - absolute index: a 0-based, uniform-step-of-1 flattening of the whole
 *   scale, used for all step/clamp arithmetic (the brewing-screen stepper
 *   and Compass's suggestion math) so rollover between main clicks falls
 *   out for free instead of needing boundary-case logic.
 */

export interface ClickScale {
  mainMin: number;
  mainMax: number;
  subMin: number;
  subMax: number;
}

/** Decimal digits needed to encode subMax unambiguously (40 -> 2, 150 -> 3). */
export function subDigits(scale: ClickScale): number {
  return String(scale.subMax).length;
}

export function subDivisor(scale: ClickScale): number {
  return 10 ** subDigits(scale);
}

/** mainClick + subClick/divisor, rounded to strip binary floating-point noise. */
export function encodeClickValue(mainClick: number, subClick: number, scale: ClickScale): number {
  const divisor = subDivisor(scale);
  return Math.round((mainClick + subClick / divisor) * divisor) / divisor;
}

/** Inverse of encodeClickValue. */
export function decodeClickValue(value: number, scale: ClickScale): { mainClick: number; subClick: number } {
  const divisor = subDivisor(scale);
  const mainClick = Math.floor(value + 1e-9);
  const subClick = Math.round((value - mainClick) * divisor);
  return { mainClick, subClick };
}

function subRange(scale: ClickScale): number {
  return scale.subMax - scale.subMin + 1;
}

/** Total number of valid (mainClick, subClick) positions across the whole scale. */
export function totalPositions(scale: ClickScale): number {
  return (scale.mainMax - scale.mainMin + 1) * subRange(scale);
}

/** (mainClick, subClick) -> a single absolute step count, 0 at (mainMin, subMin). */
export function toAbsoluteIndex(mainClick: number, subClick: number, scale: ClickScale): number {
  return (mainClick - scale.mainMin) * subRange(scale) + (subClick - scale.subMin);
}

/** Inverse of toAbsoluteIndex. Precondition: 0 <= index <= totalPositions(scale) - 1. */
export function fromAbsoluteIndex(index: number, scale: ClickScale): { mainClick: number; subClick: number } {
  const range = subRange(scale);
  const mainClick = scale.mainMin + Math.floor(index / range);
  const subClick = scale.subMin + (index % range);
  return { mainClick, subClick };
}

/** Encoded float -> absolute index, in one step. */
export function valueToIndex(value: number, scale: ClickScale): number {
  const { mainClick, subClick } = decodeClickValue(value, scale);
  return toAbsoluteIndex(mainClick, subClick, scale);
}

/** Absolute index -> encoded float, in one step. */
export function indexToValue(index: number, scale: ClickScale): number {
  const { mainClick, subClick } = fromAbsoluteIndex(index, scale);
  return encodeClickValue(mainClick, subClick, scale);
}

/** Locale-agnostic display parts. subClick is zero-padded to the scale's
 * digit width (e.g. sub=5 on a 0-40 scale -> "05") so the decimal separator
 * always means the same thing regardless of value — callers join these with
 * a locale-appropriate separator ("," for de, "." for en). */
export function formatClickParts(value: number, scale: ClickScale): { mainClick: number; subClick: string } {
  const { mainClick, subClick } = decodeClickValue(value, scale);
  return { mainClick, subClick: String(subClick).padStart(subDigits(scale), "0") };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @kvarn/core test`
Expected: PASS — all `grindClicks.test.ts` cases green, plus the pre-existing `compass.test.ts`/`freshness.test.ts`/`ratio.test.ts`/`weather.test.ts` still passing.

- [ ] **Step 5: Export from the package barrel**

Edit `packages/core/src/index.ts` — current content:

```typescript
export * from "./units";
export * from "./ratio";
export * from "./compass";
export * from "./freshness";
export * from "./weather";
```

New content:

```typescript
export * from "./units";
export * from "./ratio";
export * from "./compass";
export * from "./freshness";
export * from "./weather";
export * from "./grindClicks";
```

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/grindClicks.ts packages/core/src/grindClicks.test.ts packages/core/src/index.ts
git commit -m "Add grindClicks: main-click/subclick <-> float <-> index conversions"
```

---

## Task 2: Extend the `GrindScale` type and `GrindScaleJson` schema type

**Files:**
- Modify: `packages/core/src/compass.ts:10-19`
- Modify: `packages/db/src/schema.ts:24-32`

- [ ] **Step 1: Extend `GrindScale` in compass.ts**

Current (`packages/core/src/compass.ts:10-19`):

```typescript
export interface GrindScale {
  min: number;
  max: number;
  step: number;
  unit: string;
  /** Which direction on the raw scale means "finer". Most consumer grinders
   * (Niche, EK43-style) use lower number = finer, hence -1. Comandante-style
   * click counts also increase with coarser, so -1 covers both by default. */
  finerDirection: -1 | 1;
}
```

New:

```typescript
export interface GrindScale {
  min: number;
  max: number;
  step: number;
  unit: string;
  /** Which direction on the raw scale means "finer". Most consumer grinders
   * (Niche, EK43-style) use lower number = finer, hence -1. Comandante-style
   * click counts also increase with coarser, so -1 covers both by default. */
  finerDirection: -1 | 1;
  /** Two-dial grinders (e.g. Kingrinder K6: main click 1-4, subclick 0-40)
   * store one encoded float (see packages/core/src/grindClicks.ts) instead of
   * using min/max/step directly. When true, mainMin/mainMax/subMin/subMax
   * below are used instead — min/max/step are ignored by nextGrindSuggestion
   * (but still required on the type for backward compatibility with
   * flat-scale callers). */
  subclicksEnabled?: boolean;
  mainMin?: number;
  mainMax?: number;
  subMin?: number;
  subMax?: number;
}
```

- [ ] **Step 2: Extend `GrindScaleJson` in packages/db/src/schema.ts**

Current (`packages/db/src/schema.ts:24-32`):

```typescript
type GrindScaleJson = {
  min: number;
  max: number;
  step: number;
  unit: string;
  label: string;
  /** Sign added to the raw value to move one step finer — see packages/core/src/compass.ts. */
  finerDirection: -1 | 1;
} | null;
```

New:

```typescript
type GrindScaleJson = {
  min: number;
  max: number;
  step: number;
  unit: string;
  label: string;
  /** Sign added to the raw value to move one step finer — see packages/core/src/compass.ts. */
  finerDirection: -1 | 1;
  /** Two-dial grinders (e.g. Kingrinder K6: main click 1-4, subclick 0-40) —
   * see packages/core/src/grindClicks.ts and GrindScale in compass.ts for
   * what these mean. min/max/step above are ignored for editing/display when
   * this is true. Missing/false on existing rows means "flat scale, as
   * before" — see the Dexie migration in apps/web/src/data/db.ts. */
  subclicksEnabled: boolean;
  mainMin?: number;
  mainMax?: number;
  subMin?: number;
  subMax?: number;
} | null;
```

This is a TypeScript-only change — `grindScale` is a JSON blob column (`text(..., { mode: "json" })`), so no SQL migration is needed. Existing rows in D1 and Dexie simply won't have `subclicksEnabled` yet; see Task 5 for the Dexie-side backfill and Task 3 for how the app treats a missing field as `false`.

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @kvarn/db typecheck && pnpm --filter @kvarn/core typecheck`
Expected: PASS (no code reads `subclicksEnabled` yet, so nothing breaks from the new required field on the type — it's only enforced where a new literal object is constructed, which Task 3 handles).

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/compass.ts packages/db/src/schema.ts
git commit -m "Add subclicksEnabled + main/sub bounds to the grind scale types"
```

---

## Task 3: Rollover-aware Compass suggestions

**Files:**
- Modify: `packages/core/src/compass.ts`
- Modify: `packages/core/src/compass.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `packages/core/src/compass.test.ts` (append inside the existing `describe("nextGrindSuggestion — golden tests", ...)` block, after the last `it(...)`):

```typescript
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @kvarn/core test`
Expected: FAIL — all three new cases fail because `nextGrindSuggestion` doesn't have a subclicks branch yet (it'll compute flat-scale arithmetic using `grindScale.step` = 0.01 instead, producing very different numbers).

- [ ] **Step 3: Implement the rollover-aware branch**

In `packages/core/src/compass.ts`, add the import at the top:

```typescript
import { clamp, roundToStep } from "./units";
import type { BrewMethod } from "./units";
import { indexToValue, totalPositions, valueToIndex, type ClickScale } from "./grindClicks";
```

Then replace the tail of `nextGrindSuggestion` — current (`packages/core/src/compass.ts:158-169`):

```typescript
  // finerDirection is the sign added to the raw value to make it one step finer,
  // so a positive `totalSteps` (finer) times finerDirection gives the right sign.
  const totalSteps = stepsFiner + fractionalFiner;
  const delta = totalSteps * grindScale.finerDirection * grindScale.step;
  const grindSetting = clamp(
    roundToStep(lastBrew.grindSetting + delta, grindScale.step),
    grindScale.min,
    grindScale.max,
  );

  return { grindSetting, reasons };
}
```

New:

```typescript
  // finerDirection is the sign added to the raw value to make it one step finer,
  // so a positive `totalSteps` (finer) times finerDirection gives the right sign.
  const totalSteps = stepsFiner + fractionalFiner;

  if (
    grindScale.subclicksEnabled &&
    grindScale.mainMin !== undefined &&
    grindScale.mainMax !== undefined &&
    grindScale.subMin !== undefined &&
    grindScale.subMax !== undefined
  ) {
    const clickScale: ClickScale = {
      mainMin: grindScale.mainMin,
      mainMax: grindScale.mainMax,
      subMin: grindScale.subMin,
      subMax: grindScale.subMax,
    };
    // Same signed-steps logic as the flat scale below, but applied in
    // absolute-index space (uniform step of 1 = one subclick) so a delta
    // that crosses a main-click boundary rolls over instead of landing on
    // an invalid position like "main 1, sub 42" when subMax is 40.
    const lastIndex = valueToIndex(lastBrew.grindSetting, clickScale);
    const newIndex = clamp(Math.round(lastIndex + totalSteps * grindScale.finerDirection), 0, totalPositions(clickScale) - 1);
    return { grindSetting: indexToValue(newIndex, clickScale), reasons };
  }

  const delta = totalSteps * grindScale.finerDirection * grindScale.step;
  const grindSetting = clamp(
    roundToStep(lastBrew.grindSetting + delta, grindScale.step),
    grindScale.min,
    grindScale.max,
  );

  return { grindSetting, reasons };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @kvarn/core test`
Expected: PASS — all three new cases, plus every pre-existing `compass.test.ts` case (the flat-scale branch is untouched, so those are unaffected).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/compass.ts packages/core/src/compass.test.ts
git commit -m "Make Compass suggestions rollover-aware for two-dial grind scales"
```

---

## Task 4: `DEFAULT_GRIND_SCALE` and a shared display formatter

**Files:**
- Modify: `apps/web/src/state/store.ts`
- Test: `apps/web/src/state/store.test.ts`

- [ ] **Step 1: Update `DEFAULT_GRIND_SCALE`**

Current (`apps/web/src/state/store.ts:8-15`):

```typescript
export const DEFAULT_GRIND_SCALE: GrindScaleValue = {
  min: 0,
  max: 40,
  step: 0.5,
  unit: "clicks",
  label: "",
  finerDirection: -1,
};
```

New:

```typescript
export const DEFAULT_GRIND_SCALE: GrindScaleValue = {
  min: 0,
  max: 40,
  step: 0.5,
  unit: "clicks",
  label: "",
  finerDirection: -1,
  subclicksEnabled: false,
};
```

- [ ] **Step 2: Write the failing test for a display-formatting helper**

Add to `apps/web/src/state/store.test.ts` (append a new top-level `describe`, after the existing one closes):

```typescript
describe("formatGrindValue", () => {
  beforeEach(async () => {
    await db.products.clear();
    await db.equipment.clear();
    await db.setups.clear();
    await db.beans.clear();
    await db.brews.clear();
    await db.weatherSnapshots.clear();
    await db.recipes.clear();
    useKvarnStore.setState({ hydrated: false, products: [], equipment: [], setups: [], beans: [], brews: [], weatherSnapshots: [], recipes: [], activeSetupId: null, activeBeanId: null });
  });

  it("renders a flat-scale value as a plain number", async () => {
    await useKvarnStore.getState().hydrate();
    const grinder = useKvarnStore.getState().products.find((p) => p.kind === "grinder")!;
    const equipment = await useKvarnStore.getState().addEquipmentFromProduct(grinder.id);
    expect(formatGrindValue(useKvarnStore.getState(), equipment.id, 12.5, "de")).toBe("12.5");
  });

  it("renders a subclicks-enabled value as main,sub with a locale-appropriate separator", async () => {
    await useKvarnStore.getState().hydrate();
    const grinder = useKvarnStore.getState().products.find((p) => p.kind === "grinder")!;
    const equipment = await useKvarnStore.getState().addEquipmentFromProduct(grinder.id);
    await useKvarnStore.getState().setEquipmentGrindScale(equipment.id, {
      min: 1, max: 4.4, step: 0.01, unit: "clicks", label: "", finerDirection: -1,
      subclicksEnabled: true, mainMin: 1, mainMax: 4, subMin: 0, subMax: 40,
    });
    expect(formatGrindValue(useKvarnStore.getState(), equipment.id, 1.25, "de")).toBe("1,25");
    expect(formatGrindValue(useKvarnStore.getState(), equipment.id, 1.05, "de")).toBe("1,05");
    expect(formatGrindValue(useKvarnStore.getState(), equipment.id, 1.25, "en")).toBe("1.25");
  });
});
```

Add `formatGrindValue` to the existing import line at the top of `store.test.ts` (currently `import { equipmentKind, useKvarnStore } from "./store";`):

```typescript
import { equipmentKind, formatGrindValue, useKvarnStore } from "./store";
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter @kvarn/web test`
Expected: FAIL — `formatGrindValue` is not exported from `./store`.

- [ ] **Step 4: Implement `formatGrindValue`**

Add to `apps/web/src/state/store.ts`, directly after the existing `equipmentGrindScale` function (`apps/web/src/state/store.ts:391-395`):

```typescript
/**
 * Human-readable grind value for display (logbook rows, recipe lines, the
 * live Compass hint) — "1,25"/"1.25" for a subclicks-enabled grinder,
 * otherwise the plain number. `locale` picks the decimal separator only;
 * the underlying stored value is always a plain JS number either way.
 */
export function formatGrindValue(state: KvarnState, equipmentId: string | null, value: number, locale: "de" | "en"): string {
  const scale = equipmentGrindScale(state, equipmentId);
  if (!scale.subclicksEnabled || scale.mainMin === undefined || scale.mainMax === undefined || scale.subMin === undefined || scale.subMax === undefined) {
    return String(value);
  }
  const { mainClick, subClick } = formatClickParts(value, {
    mainMin: scale.mainMin,
    mainMax: scale.mainMax,
    subMin: scale.subMin,
    subMax: scale.subMax,
  });
  return `${mainClick}${locale === "de" ? "," : "."}${subClick}`;
}
```

Add `formatClickParts` to the `@kvarn/core` import at the top of `store.ts` (find the existing `@kvarn/core` import — if there isn't one yet, add a new line; check first with `grep -n '"@kvarn/core"' apps/web/src/state/store.ts`). If no such import exists yet, add:

```typescript
import { formatClickParts } from "@kvarn/core";
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @kvarn/web test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/state/store.ts apps/web/src/state/store.test.ts
git commit -m "Add subclicksEnabled default and a locale-aware grind value formatter"
```

---

## Task 5: Dexie migration — backfill `subclicksEnabled: false` on existing equipment

**Files:**
- Modify: `apps/web/src/data/db.ts`
- Test: `apps/web/src/data/db.test.ts` (new file)

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/data/db.test.ts`:

```typescript
import { describe, expect, it, beforeEach } from "vitest";
import Dexie from "dexie";
import { db } from "./db";

describe("Dexie migration to version 2", () => {
  beforeEach(async () => {
    await db.equipment.clear();
  });

  it("backfills subclicksEnabled: false on existing equipment rows that have a grindScale but are missing the field", async () => {
    // Simulate a pre-migration row, written directly (bypassing the app's
    // current TypeScript type, which now requires subclicksEnabled) to
    // model what's actually sitting in a real user's IndexedDB today.
    const legacyRow = {
      id: "equipment_legacy_1",
      userId: "local",
      productId: null,
      customName: null,
      kind: "grinder" as const,
      notes: null,
      burrKg: null,
      grindScale: { min: 0, max: 40, step: 1, unit: "clicks", label: "", finerDirection: -1 as const },
      photoUrl: null,
      imageUrl: null,
      updatedAt: new Date().toISOString(),
      deletedAt: null,
      clientId: "client_legacy_1",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    await db.equipment.put(legacyRow);

    // Re-running the same version's upgrade logic isn't how Dexie works (it
    // only runs once per browser database), so instead we directly assert
    // the invariant the migration is responsible for by checking the schema
    // version is at least 2 and by re-reading the row after Dexie's own
    // open() has run the upgrade chain (which already happened when `db`
    // was constructed at module load, before this test's `put` above — so
    // this test instead verifies the *shape* the upgrade guarantees for any
    // row missing the field, by calling the exported migration function
    // directly).
    const { backfillGrindScaleSubclicks } = await import("./db");
    await backfillGrindScaleSubclicks();

    const migrated = await db.equipment.get("equipment_legacy_1");
    expect(migrated?.grindScale?.subclicksEnabled).toBe(false);
  });

  it("leaves a null grindScale alone", async () => {
    const { backfillGrindScaleSubclicks } = await import("./db");
    await db.equipment.put({
      id: "equipment_no_scale",
      userId: "local",
      productId: null,
      customName: null,
      kind: "machine" as const,
      notes: null,
      burrKg: null,
      grindScale: null,
      photoUrl: null,
      imageUrl: null,
      updatedAt: new Date().toISOString(),
      deletedAt: null,
      clientId: "client_no_scale",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    await backfillGrindScaleSubclicks();
    const row = await db.equipment.get("equipment_no_scale");
    expect(row?.grindScale).toBeNull();
  });

  it("leaves an already-migrated row's subclicksEnabled: true alone", async () => {
    const { backfillGrindScaleSubclicks } = await import("./db");
    await db.equipment.put({
      id: "equipment_already_click",
      userId: "local",
      productId: null,
      customName: null,
      kind: "grinder" as const,
      notes: null,
      burrKg: null,
      grindScale: {
        min: 1, max: 4.4, step: 0.01, unit: "clicks", label: "", finerDirection: -1,
        subclicksEnabled: true, mainMin: 1, mainMax: 4, subMin: 0, subMax: 40,
      },
      photoUrl: null,
      imageUrl: null,
      updatedAt: new Date().toISOString(),
      deletedAt: null,
      clientId: "client_already_click",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    await backfillGrindScaleSubclicks();
    const row = await db.equipment.get("equipment_already_click");
    expect(row?.grindScale?.subclicksEnabled).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @kvarn/web test`
Expected: FAIL — `backfillGrindScaleSubclicks` is not exported from `./db`.

- [ ] **Step 3: Implement the migration**

In `apps/web/src/data/db.ts`, find the Dexie class definition (currently):

```typescript
export class KvarnDB extends Dexie {
  products!: EntityTable<Product, "id">;
  equipment!: EntityTable<Equipment, "id">;
  setups!: EntityTable<Setup, "id">;
  beans!: EntityTable<Bean, "id">;
  brews!: EntityTable<Brew, "id">;
  weatherSnapshots!: EntityTable<WeatherSnapshot, "id">;
  recipes!: EntityTable<Recipe, "id">;

  constructor() {
    super("kvarn");
    this.version(1).stores({
      products: "id, kind, brand",
      equipment: "id, userId, productId",
      setups: "id, userId, method",
      beans: "id, userId",
      brews: "id, userId, setupId, beanId, brewedAt",
      weatherSnapshots: "id, geoCell, takenAt",
      recipes: "id, userId, setupId, beanId",
    });
  }
}

export const db = new KvarnDB();
```

Replace with:

```typescript
export class KvarnDB extends Dexie {
  products!: EntityTable<Product, "id">;
  equipment!: EntityTable<Equipment, "id">;
  setups!: EntityTable<Setup, "id">;
  beans!: EntityTable<Bean, "id">;
  brews!: EntityTable<Brew, "id">;
  weatherSnapshots!: EntityTable<WeatherSnapshot, "id">;
  recipes!: EntityTable<Recipe, "id">;

  constructor() {
    super("kvarn");
    this.version(1).stores({
      products: "id, kind, brand",
      equipment: "id, userId, productId",
      setups: "id, userId, method",
      beans: "id, userId",
      brews: "id, userId, setupId, beanId, brewedAt",
      weatherSnapshots: "id, geoCell, takenAt",
      recipes: "id, userId, setupId, beanId",
    });
    // v2: grindScale gained subclicksEnabled (main-click/subclick grinders,
    // e.g. Kingrinder K6) — existing rows predate the field entirely, so
    // backfill it to false (flat scale, today's behavior) rather than
    // leaving it undefined everywhere reads happen to check it.
    this.version(2)
      .stores({
        products: "id, kind, brand",
        equipment: "id, userId, productId",
        setups: "id, userId, method",
        beans: "id, userId",
        brews: "id, userId, setupId, beanId, brewedAt",
        weatherSnapshots: "id, geoCell, takenAt",
        recipes: "id, userId, setupId, beanId",
      })
      .upgrade((tx) =>
        tx
          .table("equipment")
          .toCollection()
          .modify((row: Equipment) => {
            if (row.grindScale && row.grindScale.subclicksEnabled === undefined) {
              row.grindScale.subclicksEnabled = false;
            }
          }),
      );
  }
}

export const db = new KvarnDB();

/**
 * Same backfill as the v2 upgrade above, exposed standalone so it's
 * unit-testable without spinning up a second real IndexedDB version chain
 * (Dexie only runs `.upgrade()` once per browser database, on the version
 * transition itself) — see apps/web/src/data/db.test.ts.
 */
export async function backfillGrindScaleSubclicks(): Promise<void> {
  const rows = await db.equipment.toArray();
  await Promise.all(
    rows
      .filter((row) => row.grindScale && row.grindScale.subclicksEnabled === undefined)
      .map((row) => db.equipment.update(row.id, { grindScale: { ...row.grindScale!, subclicksEnabled: false } })),
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @kvarn/web test`
Expected: PASS.

- [ ] **Step 5: Typecheck and lint**

Run: `pnpm --filter @kvarn/web typecheck && pnpm --filter @kvarn/web lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/data/db.ts apps/web/src/data/db.test.ts
git commit -m "Add Dexie v2 migration: backfill subclicksEnabled: false on existing equipment"
```

---

## Task 6: Kingrinder K6 catalog default

**Files:**
- Modify: `apps/web/public/data/seed-products.json:3996-4007`
- Modify: `apps/web/src/data/db.ts` (bump `SEED_CATALOG_VERSION`)

- [ ] **Step 1: Update the Kingrinder K6 entry**

Current (`apps/web/public/data/seed-products.json:3995-4007`):

```json
  {
    "id": "grinder-kingrinder-k6",
    "kind": "grinder",
    "brand": "Kingrinder",
    "model": "K6",
    "grindScale": {
      "min": 0,
      "max": 40,
      "step": 1,
      "unit": "clicks",
      "label": "Klicks",
      "finerDirection": -1
    },
```

New:

```json
  {
    "id": "grinder-kingrinder-k6",
    "kind": "grinder",
    "brand": "Kingrinder",
    "model": "K6",
    "grindScale": {
      "min": 1,
      "max": 4.4,
      "step": 0.01,
      "unit": "clicks",
      "label": "Klicks",
      "finerDirection": -1,
      "subclicksEnabled": true,
      "mainMin": 1,
      "mainMax": 4,
      "subMin": 0,
      "subMax": 40
    },
```

- [ ] **Step 2: Bump the seed catalog version**

Current (`apps/web/src/data/db.ts`, near the top):

```typescript
const SEED_CATALOG_VERSION = 5;
```

New:

```typescript
const SEED_CATALOG_VERSION = 6;
```

- [ ] **Step 3: Verify the JSON is still valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('apps/web/public/data/seed-products.json', 'utf8')); console.log('valid')"`
Expected: prints `valid`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/public/data/seed-products.json apps/web/src/data/db.ts
git commit -m "Seed Kingrinder K6 with real main/subclick ranges by default"
```

---

## Task 7: i18n strings

**Files:**
- Modify: `apps/web/src/i18n/de.ts`
- Modify: `apps/web/src/i18n/en.ts`

- [ ] **Step 1: Add the new `setup` namespace keys**

In `apps/web/src/i18n/de.ts`, current (`de.ts:89-93`):

```typescript
    grindMin: "Min",
    grindMax: "Max (offen)",
    grindStep: "Schritt",
    saveGrindScale: "Speichern",
    tapToEdit: "Zum Bearbeiten tippen",
```

New:

```typescript
    grindMin: "Min",
    grindMax: "Max (offen)",
    grindStep: "Schritt",
    saveGrindScale: "Speichern",
    tapToEdit: "Zum Bearbeiten tippen",
    subclicksEnabled: "Unterklicks aktivieren",
    mainClickMin: "Hauptklick Min",
    mainClickMax: "Hauptklick Max",
    subClickMin: "Unterklick Min",
    subClickMax: "Unterklick Max",
```

In `apps/web/src/i18n/en.ts`, current (`en.ts:91-95`):

```typescript
    grindMin: "Min",
    grindMax: "Max (open-ended)",
    grindStep: "Step",
    saveGrindScale: "Save",
    tapToEdit: "Tap to edit",
```

New:

```typescript
    grindMin: "Min",
    grindMax: "Max (open-ended)",
    grindStep: "Step",
    saveGrindScale: "Save",
    tapToEdit: "Tap to edit",
    subclicksEnabled: "Enable subclicks",
    mainClickMin: "Main click min",
    mainClickMax: "Main click max",
    subClickMin: "Subclick min",
    subClickMax: "Subclick max",
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @kvarn/web typecheck`
Expected: PASS — `de.ts`/`en.ts` share a structural `Dictionary` type (`en.ts` is typed as `Dictionary` from `de.ts`), so a mismatch between the two files' keys would fail here.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/i18n/de.ts apps/web/src/i18n/en.ts
git commit -m "Add i18n strings for subclick settings"
```

---

## Task 8: `GrindScaleFields` — toggle + two-dial editing mode

**Files:**
- Modify: `apps/web/src/components/GrindScaleFields.tsx`

- [ ] **Step 1: Replace the component**

Current full file:

```typescript
import type { GrindScaleValue } from "../state/store";
import { useT } from "../i18n";

/** The three fields a grind scale boils down to for editing purposes — unit,
 * label, and finerDirection are preserved from whatever `value` already has. */
export function GrindScaleFields({ value, onChange }: { value: GrindScaleValue; onChange: (next: GrindScaleValue) => void }) {
  const t = useT("setup");
  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-col gap-0.5">
        <label className="text-[13px] text-muted">{t("grindMin")}</label>
        <input
          type="number"
          value={value.min}
          onChange={(e) => onChange({ ...value, min: Number(e.target.value) })}
          className="w-20 border border-linen rounded-control px-2 py-2 text-base bg-birch"
        />
      </div>
      <div className="flex flex-col gap-0.5">
        <label className="text-[13px] text-muted">{t("grindMax")}</label>
        <input
          type="number"
          value={value.max}
          onChange={(e) => onChange({ ...value, max: Number(e.target.value) })}
          className="w-20 border border-linen rounded-control px-2 py-2 text-base bg-birch"
        />
      </div>
      <div className="flex flex-col gap-0.5">
        <label className="text-[13px] text-muted">{t("grindStep")}</label>
        <input
          type="number"
          step="0.1"
          value={value.step}
          onChange={(e) => onChange({ ...value, step: Number(e.target.value) })}
          className="w-20 border border-linen rounded-control px-2 py-2 text-base bg-birch"
        />
      </div>
    </div>
  );
}
```

New full file:

```typescript
import type { GrindScaleValue } from "../state/store";
import { useT } from "../i18n";

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-[13px] text-muted">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-20 border border-linen rounded-control px-2 py-2 text-base bg-birch"
      />
    </div>
  );
}

/** Flat scale: min/max/step. Two-dial scale (subclicksEnabled): main click
 * min/max + subclick min/max, each an integer-step-of-1 dial — see
 * docs/superpowers/specs/2026-07-05-grind-main-subclicks-design.md. unit,
 * label, and finerDirection are preserved from whatever `value` already has
 * in both modes. */
export function GrindScaleFields({ value, onChange }: { value: GrindScaleValue; onChange: (next: GrindScaleValue) => void }) {
  const t = useT("setup");
  const subclicksEnabled = value.subclicksEnabled ?? false;

  return (
    <div>
      <div className="flex items-center justify-between py-[13px] border-b border-linen">
        <div className="text-base">{t("subclicksEnabled")}</div>
        <button
          type="button"
          role="switch"
          aria-checked={subclicksEnabled}
          onClick={() =>
            onChange({
              ...value,
              subclicksEnabled: !subclicksEnabled,
              mainMin: value.mainMin ?? 1,
              mainMax: value.mainMax ?? 4,
              subMin: value.subMin ?? 0,
              subMax: value.subMax ?? 40,
            })
          }
          className={`w-11 h-6 rounded-full relative transition-colors ${subclicksEnabled ? "bg-copper" : "bg-linen"}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${subclicksEnabled ? "translate-x-5" : ""}`}
          />
        </button>
      </div>
      {subclicksEnabled ? (
        <div className="flex items-center gap-3 pt-3 flex-wrap">
          <NumberField label={t("mainClickMin")} value={value.mainMin ?? 1} onChange={(v) => onChange({ ...value, mainMin: v })} />
          <NumberField label={t("mainClickMax")} value={value.mainMax ?? 4} onChange={(v) => onChange({ ...value, mainMax: v })} />
          <NumberField label={t("subClickMin")} value={value.subMin ?? 0} onChange={(v) => onChange({ ...value, subMin: v })} />
          <NumberField label={t("subClickMax")} value={value.subMax ?? 40} onChange={(v) => onChange({ ...value, subMax: v })} />
        </div>
      ) : (
        <div className="flex items-center gap-3 pt-3">
          <NumberField label={t("grindMin")} value={value.min} onChange={(v) => onChange({ ...value, min: v })} />
          <NumberField label={t("grindMax")} value={value.max} onChange={(v) => onChange({ ...value, max: v })} />
          <NumberField label={t("grindStep")} value={value.step} onChange={(v) => onChange({ ...value, step: v })} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `pnpm --filter @kvarn/web typecheck && pnpm --filter @kvarn/web lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/GrindScaleFields.tsx
git commit -m "Add subclicks toggle and two-dial fields to GrindScaleFields"
```

This is used unmodified by both `Setup.tsx`'s equipment editor and `Onboarding.tsx`'s post-add grind-scale confirm popup — no changes needed in either of those files.

---

## Task 9: Shared `GrindStepper` component + odometer stepper on the brew screen

**Files:**
- Create: `apps/web/src/components/GrindStepper.tsx`
- Modify: `apps/web/src/routes/Bruehen.tsx`

This is written as a standalone component (not inlined into `Bruehen.tsx`) because the upcoming manual-brew-entry feature (`docs/superpowers/plans/2026-07-05-manual-brew-entry.md`) needs the exact same flat-vs-odometer branching in a second place — extracting it now avoids writing throwaway inline code that immediately needs pulling back out.

- [ ] **Step 1: Create `GrindStepper`**

Create `apps/web/src/components/GrindStepper.tsx`:

```typescript
import { ParamStepper } from "@kvarn/ui";
import { formatClickParts, indexToValue, valueToIndex, type ClickScale } from "@kvarn/core";
import type { GrindScaleValue } from "../state/store";

function clickScaleOf(grindScale: GrindScaleValue): ClickScale | null {
  if (grindScale.mainMin === undefined || grindScale.mainMax === undefined || grindScale.subMin === undefined || grindScale.subMax === undefined) {
    return null;
  }
  return { mainMin: grindScale.mainMin, mainMax: grindScale.mainMax, subMin: grindScale.subMin, subMax: grindScale.subMax };
}

/** Renders a plain flat-scale ParamStepper, or — for a two-dial grinder
 * (subclicksEnabled) — an odometer-style stepper that steps by exactly one
 * subclick and displays "main,sub"/"main.sub" depending on locale. See
 * docs/superpowers/specs/2026-07-05-grind-main-subclicks-design.md. */
export function GrindStepper({
  label,
  grindScale,
  value,
  onChange,
  locale,
}: {
  label: string;
  grindScale: GrindScaleValue;
  value: number;
  onChange: (value: number) => void;
  locale: "de" | "en";
}) {
  const clickScale = clickScaleOf(grindScale);

  if (grindScale.subclicksEnabled && clickScale) {
    const totalPositions = (clickScale.mainMax - clickScale.mainMin + 1) * (clickScale.subMax - clickScale.subMin + 1);
    return (
      <ParamStepper
        label={label}
        unit={grindScale.unit}
        value={valueToIndex(value, clickScale)}
        step={1}
        min={0}
        max={totalPositions - 1}
        formatValue={(index) => {
          const { mainClick, subClick } = formatClickParts(indexToValue(index, clickScale), clickScale);
          return `${mainClick}${locale === "de" ? "," : "."}${subClick}`;
        }}
        onChange={(index) => onChange(indexToValue(index, clickScale))}
      />
    );
  }

  return (
    <ParamStepper label={label} unit={grindScale.unit} value={value} step={grindScale.step} min={grindScale.min} max={grindScale.max} onChange={onChange} />
  );
}
```

Note: typing on the odometer variant works in raw absolute-index terms (tap-to-type shows the index, not "main,sub" text) — an accepted rough edge per the design doc, since dragging is the primary interaction for a two-dial grinder (matches turning a physical dial) and `ParamStepper` is deliberately left unmodified.

- [ ] **Step 2: Wire it into Bruehen.tsx**

Add the import to `apps/web/src/routes/Bruehen.tsx`, alongside the other component imports:

```typescript
import { GrindStepper } from "../components/GrindStepper";
```

Add `useLocale` to the existing `../i18n` import (currently `import { useT, useTags } from "../i18n";`):

```typescript
import { useLocale, useT, useTags } from "../i18n";
```

Inside the `Bruehen()` component, alongside the other `useT(...)` calls near the top, add:

```typescript
const { locale } = useLocale();
```

Current (`Bruehen.tsx:315-325`):

```tsx
      {step === "params" ? (
        <Card>
          <ParamStepper
            label={grindScale.label || t("grindLabel")}
            unit={grindScale.unit}
            value={grindSetting}
            step={grindScale.step}
            min={grindScale.min}
            max={grindScale.max}
            onChange={setGrindSetting}
          />
```

New:

```tsx
      {step === "params" ? (
        <Card>
          <GrindStepper
            label={grindScale.label || t("grindLabel")}
            grindScale={grindScale}
            value={grindSetting}
            onChange={setGrindSetting}
            locale={locale}
          />
```

Leave everything else in the `params` step (dose, target yield, pre-infusion, ratio viz, Compass hint, "start timer" button) exactly as-is — only the grind stepper line changes.

- [ ] **Step 3: Typecheck and lint**

Run: `pnpm --filter @kvarn/web typecheck && pnpm --filter @kvarn/web lint`
Expected: PASS.

- [ ] **Step 4: Manual verification in the browser**

1. Start the dev server if not already running (`pnpm dev` from `apps/web`, or use whatever preview tooling is already set up).
2. Go to Setup, open the Kingrinder K6 grinder's editor (or any grinder — add one from the catalog if none exists), confirm the subclicks toggle appears and is on for a freshly-added Kingrinder K6 (Task 6's seed default).
3. Go to Brühen with a setup using that grinder. Confirm the grind stepper shows `"1,00"`-style text (not a raw index number).
4. Drag the stepper past `40` sub — confirm it rolls over to `"2,00"` instead of showing an invalid value.
5. Tap the stepper to type a value — note (and accept, per the design's documented trade-off) that typing works in raw absolute-index terms here, not "main,sub" text; this is an intentional scope boundary, not a bug — dragging is the primary interaction for a two-dial grinder, matching how the physical dial works.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/GrindStepper.tsx apps/web/src/routes/Bruehen.tsx
git commit -m "Add GrindStepper component and wire it into Bruehen"
```

---

## Task 10: Display formatting in Kompass, BeanDetail, and Heute

**Files:**
- Modify: `apps/web/src/routes/Kompass.tsx:34-49,98`
- Modify: `apps/web/src/routes/BeanDetail.tsx:99-105`
- Modify: `apps/web/src/routes/Heute.tsx:127`

- [ ] **Step 1: Read the exact current surrounding code**

Before editing, run:

```bash
sed -n '25,55p' apps/web/src/routes/Kompass.tsx
sed -n '90,102p' apps/web/src/routes/Kompass.tsx
sed -n '90,110p' apps/web/src/routes/BeanDetail.tsx
sed -n '115,130p' apps/web/src/routes/Heute.tsx
```

Confirm the recipe-line and logbook-row rendering matches what's described below before editing — these three files may have shifted slightly since this plan was written; use the actual surrounding code (state variables in scope, existing imports) rather than assuming line numbers are exact.

- [ ] **Step 2: Wire `formatGrindValue` into Kompass.tsx**

In `apps/web/src/routes/Kompass.tsx`, add `formatGrindValue` to the existing `../state/store` import, and `useLocale` to the existing `../i18n` import (both already imported for other purposes in this file — merge into the existing import statements rather than adding new ones).

At the `recipeLine` call site (around line 45, inside the recipe-mapping block), change:

```typescript
grind: params?.grindSetting ?? "—",
```

to:

```typescript
grind: params?.grindSetting !== undefined ? formatGrindValue(state, recipe.setupId ? setups.find((s) => s.id === recipe.setupId)?.grinderEquipmentId ?? null : null, params.grindSetting, locale) : "—",
```

(`state`, `setups`, and `locale` must be in scope — `state` from whatever `useKvarnStore()` call already exists in this component, `setups` from the store, `locale` from `useLocale()`. If `setups` isn't already destructured from the store in this component, add it to the existing destructuring.)

At the `logRowMeta` call site (around line 98), change:

```typescript
grind: b.grindSetting,
```

to:

```typescript
grind: formatGrindValue(state, setups.find((s) => s.id === b.setupId)?.grinderEquipmentId ?? null, b.grindSetting, locale),
```

- [ ] **Step 3: Wire `formatGrindValue` into BeanDetail.tsx**

Same pattern as the `recipeLine` change above, at `apps/web/src/routes/BeanDetail.tsx:105`. Change:

```typescript
grind: params?.grindSetting ?? "—",
```

to:

```typescript
grind: params?.grindSetting !== undefined ? formatGrindValue(state, recipe.setupId ? setups.find((s) => s.id === recipe.setupId)?.grinderEquipmentId ?? null : null, params.grindSetting, locale) : "—",
```

Add the same imports (`formatGrindValue` from `../state/store`, `useLocale` from `../i18n`) and ensure `setups` and `locale` are in scope, following whatever this component's existing store/locale access pattern is.

- [ ] **Step 4: Wire `formatGrindValue` into Heute.tsx**

At `apps/web/src/routes/Heute.tsx:127`, change:

```tsx
<div className="text-sm text-muted">{b.grindSetting} · {b.doseG}g → {b.actualYieldG ?? b.targetYieldG}g</div>
```

to:

```tsx
<div className="text-sm text-muted">{formatGrindValue(state, setups.find((s) => s.id === b.setupId)?.grinderEquipmentId ?? null, b.grindSetting, locale)} · {b.doseG}g → {b.actualYieldG ?? b.targetYieldG}g</div>
```

Add the same imports and ensure `setups`/`locale` are in scope.

- [ ] **Step 5: Typecheck and lint**

Run: `pnpm --filter @kvarn/web typecheck && pnpm --filter @kvarn/web lint`
Expected: PASS.

- [ ] **Step 6: Manual verification in the browser**

1. Complete a brew (or manually adjust an existing one via the timer flow) using a subclicks-enabled grinder.
2. Check Kompass's logbook — the grind value should show as `"1,25"`-style text, not a raw float.
3. Check the bean's recipe line (BeanDetail) and Heute's "ready for next brew" card — same formatting.
4. Check a brew made with a flat-scale grinder still displays as a plain number (e.g. `"12.5"`), unaffected.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/routes/Kompass.tsx apps/web/src/routes/BeanDetail.tsx apps/web/src/routes/Heute.tsx
git commit -m "Format two-dial grind values as main,sub in logbook and recipe displays"
```

---

## Task 11: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full workspace test/lint/typecheck suite**

Run: `pnpm -w lint && pnpm -w typecheck && pnpm -w test`
Expected: PASS across all 6 packages (`@kvarn/api-client`, `@kvarn/core`, `@kvarn/db`, `@kvarn/ui`, `@kvarn/web`, `@kvarn/worker`).

- [ ] **Step 2: Manual end-to-end browser check**

Using the preview tooling already set up for this project:
1. Add a Kingrinder K6 grinder from the catalog in Setup (or use an existing one) — confirm its editor shows the subclicks toggle already on, with mainMin=1/mainMax=4/subMin=0/subMax=40.
2. Add a different, flat-scale grinder — confirm its editor still shows the plain min/max/step fields, toggle off by default.
3. Toggle subclicks on for the flat-scale grinder manually, enter a custom main/sub range, save, reopen the editor — confirm the values persisted.
4. Brew with the Kingrinder K6 setup — confirm the odometer stepper renders, drag past a main-click boundary and confirm rollover, save the brew.
5. Check Kompass's logbook for that brew — confirm `"1,XX"`-style display.
6. Check the Compass suggestion hint text on a second brew with the same setup+bean — confirm it's a sensible `"1,XX"`-style number, not something like `"1.87"` (which would indicate the flat-scale branch ran instead of the click branch).

- [ ] **Step 3: Add a release note entry**

Per the standing project convention (`apps/web/src/releaseNotes.ts`), add an entry for this feature at `version: <next commit count>` — check the current count first with `git rev-list --count HEAD`, then add 1.

- [ ] **Step 4: Final commit and push**

```bash
git add apps/web/src/releaseNotes.ts
git commit -m "Add release note for grind main/sub-click support"
git push origin main
```
