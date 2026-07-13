import { clamp, roundToStep } from "./units";
import type { BrewMethod } from "./units";

/**
 * Kompass Phase 1 — deterministic rule-based grind suggestion.
 * Pure TS, no I/O: runs identically in browser, worker, and tests.
 * See docs/03_TECH_KONZEPT.md §6 for the design.
 */

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

export interface CompassReason {
  factor: string;
  delta: number;
  effect: string;
}

export interface LastBrew {
  grindSetting: number;
  timeTotalS: number;
  balance: number; // -5 (sour) .. +5 (bitter)
}

export interface CompassInput {
  method: BrewMethod;
  grindScale: GrindScale;
  lastBrew: LastBrew | null;
  beanAgeDays?: number;
  humidityDeltaPct?: number;
}

export interface CompassSuggestion {
  grindSetting: number;
  reasons: CompassReason[];
}

const METHOD_TARGET_TIME_S: Record<BrewMethod, [number, number] | null> = {
  espresso: [25, 32],
  v60: [150, 210],
  aeropress: [60, 120],
  frenchpress: [240, 300],
  moka: null,
  auto: [180, 240],
};

const METHOD_DEFAULT_FRACTION: Record<BrewMethod, number> = {
  // where in [min,max] of the grind scale a first-timer should start
  espresso: 0.25,
  v60: 0.55,
  aeropress: 0.5,
  frenchpress: 0.85,
  moka: 0.35,
  auto: 0.5,
};

function scaleMidpoint(scale: GrindScale, fraction: number): number {
  const raw = scale.min + (scale.max - scale.min) * fraction;
  return roundToStep(raw, scale.step);
}

/**
 * Suggest the next grind setting for a setup/bean combination.
 * No history -> method default. With history -> dial-in-matrix correction.
 */
export function nextGrindSuggestion(input: CompassInput): CompassSuggestion {
  const { method, grindScale, lastBrew, beanAgeDays, humidityDeltaPct } = input;

  if (!lastBrew) {
    const grindSetting = scaleMidpoint(grindScale, METHOD_DEFAULT_FRACTION[method]);
    return {
      grindSetting,
      reasons: [
        {
          factor: "no_history",
          delta: 0,
          effect: "Kein Verlauf für diese Kombination – Methoden-Standard verwendet.",
        },
      ],
    };
  }

  const reasons: CompassReason[] = [];
  let stepsFiner = 0; // positive = move finer, negative = move coarser

  // 1. Balance is the primary dial-in signal.
  if (lastBrew.balance <= -2) {
    const magnitude = clamp(Math.round(Math.abs(lastBrew.balance) / 2), 1, 2);
    stepsFiner += magnitude;
    reasons.push({
      factor: "balance",
      delta: magnitude,
      effect: `Letzter Bezug war sauer (Balance ${lastBrew.balance}) – feiner mahlen.`,
    });
  } else if (lastBrew.balance >= 2) {
    const magnitude = clamp(Math.round(lastBrew.balance / 2), 1, 2);
    stepsFiner -= magnitude;
    reasons.push({
      factor: "balance",
      delta: -magnitude,
      effect: `Letzter Bezug war bitter (Balance ${lastBrew.balance}) – gröber mahlen.`,
    });
  }

  // 2. Brew time vs. method target window.
  const targetWindow = METHOD_TARGET_TIME_S[method];
  if (targetWindow) {
    const [minS, maxS] = targetWindow;
    if (lastBrew.timeTotalS < minS) {
      stepsFiner += 1;
      reasons.push({
        factor: "time_too_fast",
        delta: 1,
        effect: `Brühzeit ${lastBrew.timeTotalS}s war kürzer als Zielfenster (${minS}-${maxS}s) – feiner mahlen.`,
      });
    } else if (lastBrew.timeTotalS > maxS) {
      stepsFiner -= 1;
      reasons.push({
        factor: "time_too_slow",
        delta: -1,
        effect: `Brühzeit ${lastBrew.timeTotalS}s war länger als Zielfenster (${minS}-${maxS}s) – gröber mahlen.`,
      });
    }
  }

  // 3. Bean age drift: fast-degassing window, standard prior.
  let fractionalFiner = 0;
  if (beanAgeDays !== undefined && beanAgeDays >= 4 && beanAgeDays <= 8) {
    fractionalFiner += 0.1;
    reasons.push({
      factor: "bean_age",
      delta: 0.1,
      effect: `Bohne ist ${beanAgeDays} Tage alt (Tag 4-8 entgast schnell) – minimal feiner.`,
    });
  }

  // 4. Humidity drift (uncalibrated default, per-user calibration lands in Phase 2).
  if (humidityDeltaPct !== undefined && Math.abs(humidityDeltaPct) > 15) {
    const direction = humidityDeltaPct > 0 ? -0.5 : 0.5;
    fractionalFiner += direction;
    reasons.push({
      factor: "humidity",
      delta: direction,
      effect: `Luftfeuchte-Delta ${humidityDeltaPct > 0 ? "+" : ""}${humidityDeltaPct}% – ${
        direction > 0 ? "leicht feiner" : "leicht gröber"
      } mahlen (Schätzwert, noch unkalibriert).`,
    });
  }

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
