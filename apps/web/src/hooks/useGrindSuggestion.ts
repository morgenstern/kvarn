import { useMemo } from "react";
import { deriveBrewMethod, nextGrindSuggestion } from "@kvarn/core";
import type { Bean, WeatherSnapshot } from "@kvarn/db";
import { equipmentGrindScale, equipmentMethodHint, lastBrewFor, weatherSnapshotFor, type KvarnState } from "../state/store";
import { beanAgeDaysFor } from "../utils/beanAge";

/**
 * Shared with Bruehen (active weather capture), Heute (passive preview of
 * the latest known snapshot), and ManualBrewEntry (historical entry, no live
 * weather) — same Kompass reasoning, different weather sourcing per
 * docs/02_UX_KONZEPT.md's "weather never blocks/prompts unexpectedly" rule.
 * Method is no longer a stored field (see docs/superpowers/specs/
 * 2026-07-14-remove-setup-concept-design.md) — it's derived here from the
 * bean's type and the selected machine's method hint.
 */
export function useGrindSuggestion(
  state: KvarnState,
  grinderEquipmentId: string | null,
  machineEquipmentId: string | null,
  bean: Bean | undefined,
  weatherSnapshot: WeatherSnapshot | null | undefined,
) {
  const grindScale = equipmentGrindScale(state, grinderEquipmentId);
  const method = deriveBrewMethod(bean?.beanType, equipmentMethodHint(state, machineEquipmentId));

  const suggestion = useMemo(() => {
    if (!grinderEquipmentId || !bean) return null;
    const lastBrew = lastBrewFor(state, grinderEquipmentId, machineEquipmentId, bean.id);
    const lastWeather = lastBrew ? weatherSnapshotFor(state, lastBrew.weatherId) : undefined;
    const humidityDeltaPct =
      weatherSnapshot?.humidityPct != null && lastWeather?.humidityPct != null
        ? weatherSnapshot.humidityPct - lastWeather.humidityPct
        : undefined;
    return nextGrindSuggestion({
      method,
      grindScale,
      lastBrew: lastBrew
        ? { grindSetting: lastBrew.grindSetting, timeTotalS: lastBrew.timeTotalS, balance: lastBrew.balance ?? 0 }
        : null,
      beanAgeDays: beanAgeDaysFor(bean.roastDate) ?? undefined,
      humidityDeltaPct,
    });
    // Only recompute when the underlying combination or the weather snapshot
    // changes, not on every render — this is a one-shot default, not live.
    // bean?.beanType is included (not just bean?.id) because method depends
    // on it directly via deriveBrewMethod above, and a bean's type can be
    // edited without its id changing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grinderEquipmentId, machineEquipmentId, bean?.id, bean?.beanType, weatherSnapshot?.id]);

  return { grindScale, suggestion, method };
}
