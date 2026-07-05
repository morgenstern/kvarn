import { useMemo } from "react";
import { nextGrindSuggestion } from "@kvarn/core";
import type { Bean, Setup, WeatherSnapshot } from "@kvarn/db";
import { equipmentGrindScale, lastBrewFor, weatherSnapshotFor, type KvarnState } from "../state/store";

function beanAgeDaysFor(roastDate: string | null): number | null {
  if (!roastDate) return null;
  return Math.max(0, Math.round((Date.now() - new Date(roastDate).getTime()) / 86_400_000));
}

/**
 * Shared with Bruehen (active weather capture) and Heute (passive preview of
 * the latest known snapshot) — same Kompass reasoning, different weather
 * sourcing per docs/02_UX_KONZEPT.md's "weather never blocks/prompts
 * unexpectedly" rule.
 */
export function useGrindSuggestion(
  state: KvarnState,
  setup: Setup | undefined,
  bean: Bean | undefined,
  weatherSnapshot: WeatherSnapshot | null | undefined,
) {
  const grindScale = equipmentGrindScale(state, setup?.grinderEquipmentId ?? null);

  const suggestion = useMemo(() => {
    if (!setup || !bean) return null;
    const lastBrew = lastBrewFor(state, setup.id, bean.id);
    const lastWeather = lastBrew ? weatherSnapshotFor(state, lastBrew.weatherId) : undefined;
    const humidityDeltaPct =
      weatherSnapshot?.humidityPct != null && lastWeather?.humidityPct != null
        ? weatherSnapshot.humidityPct - lastWeather.humidityPct
        : undefined;
    return nextGrindSuggestion({
      method: setup.method,
      grindScale,
      lastBrew: lastBrew
        ? { grindSetting: lastBrew.grindSetting, timeTotalS: lastBrew.timeTotalS, balance: lastBrew.balance ?? 0 }
        : null,
      beanAgeDays: beanAgeDaysFor(bean.roastDate) ?? undefined,
      humidityDeltaPct,
    });
    // Only recompute when the underlying combination or the weather snapshot
    // changes, not on every render — this is a one-shot default, not live.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup?.id, bean?.id, weatherSnapshot?.id]);

  return { grindScale, suggestion };
}
