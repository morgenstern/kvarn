import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button, Card, Chip, Hint, ParamStepper, RatingSlider, TimerRing } from "@kvarn/ui";
import { computeRatio, nextGrindSuggestion } from "@kvarn/core";
import type { WeatherSnapshot } from "@kvarn/db";
import {
  activeBean,
  activeSetup,
  equipmentProduct,
  lastBrewFor,
  useKvarnStore,
  weatherSnapshotFor,
} from "../state/store";
import { useStopwatch } from "../hooks/useStopwatch";
import { useT, useTags } from "../i18n";

type Step = "params" | "timer" | "rating";

function beanAgeDaysFor(roastDate: string | null): number | null {
  if (!roastDate) return null;
  return Math.max(0, Math.round((Date.now() - new Date(roastDate).getTime()) / 86_400_000));
}

export function Bruehen() {
  const state = useKvarnStore();
  const setup = activeSetup(state);
  const bean = activeBean(state);
  const grinder = equipmentProduct(state, setup?.grinderEquipmentId ?? null);
  const commitBrew = useKvarnStore((s) => s.commitBrew);
  const captureWeatherSnapshot = useKvarnStore((s) => s.captureWeatherSnapshot);
  const navigate = useNavigate();
  const stopwatch = useStopwatch();
  const t = useT("bruehen");
  const visualTagOptions = useTags("bruehen", "visualTags");
  const flavorTagOptions = useTags("bruehen", "flavorTags");

  const grindScale = grinder?.grindScale ?? {
    min: 0,
    max: 40,
    step: 0.5,
    unit: "clicks",
    label: t("grindLabel"),
    finerDirection: -1 as const,
  };

  const [weatherSnapshot, setWeatherSnapshot] = useState<WeatherSnapshot | null>(null);

  useEffect(() => {
    captureWeatherSnapshot().then(setWeatherSnapshot);
    // Capture once per brew session, on entering the screen — not on every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    // Only recompute when the underlying combination or the weather snapshot changes,
    // not on every render — this is a one-shot default, not a live recalculation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup?.id, bean?.id, weatherSnapshot?.id]);

  const [step, setStep] = useState<Step>("params");
  const [grindSetting, setGrindSetting] = useState(
    () => suggestion?.grindSetting ?? Math.round(((grindScale.min + grindScale.max) / 2) / grindScale.step) * grindScale.step,
  );
  const [doseG, setDoseG] = useState(18);
  const [targetYieldG, setTargetYieldG] = useState(36);
  const [actualYieldG, setActualYieldG] = useState(36);
  const [ratingTotal, setRatingTotal] = useState(7);
  const [balance, setBalance] = useState(0);
  const [visualTags, setVisualTags] = useState<string[]>([]);
  const [flavorTags, setFlavorTags] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  if (!setup || !bean) {
    return (
      <div>
        <h1 className="font-display text-[28px] mt-3.5 mb-0.5">{t("title")}</h1>
        <Card>
          <p className="text-sm">{t("needsSetupAndBean")}</p>
        </Card>
      </div>
    );
  }

  function toggleTag(list: string[], setList: (v: string[]) => void, tag: string) {
    setList(list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag]);
  }

  async function finish() {
    await commitBrew({
      setupId: setup!.id,
      beanId: bean!.id,
      weatherId: weatherSnapshot?.id ?? null,
      brewedAt: new Date().toISOString(),
      grindSetting,
      doseG,
      targetYieldG,
      waterTempC: null,
      preinfusionS: null,
      puckPrep: null,
      beanAgeDays: beanAgeDaysFor(bean!.roastDate),
      timeTotalS: Math.round(stopwatch.elapsedS * 10) / 10,
      timeFirstDropS: null,
      pressureAvgBar: null,
      pressurePeakBar: null,
      actualYieldG,
      flowGs: stopwatch.elapsedS > 0 ? Math.round((actualYieldG / stopwatch.elapsedS) * 10) / 10 : null,
      ratingTotal,
      balance,
      sweetness: null,
      body: null,
      crema: null,
      visualTags,
      flavorTags,
      tdsPct: null,
      note: null,
      photoUrl: null,
      isDialIn: false,
      recipeId: null,
    });
    setSaved(true);
  }

  if (saved) {
    return (
      <div>
        <h1 className="font-display text-[28px] mt-3.5 mb-0.5">{t("savedTitle")}</h1>
        <p className="text-sm text-muted">{t("savedSubtitle")}</p>
        <Button onClick={() => navigate({ to: "/" })}>{t("backToToday")}</Button>
        <Button variant="ghost" onClick={() => navigate({ to: "/kompass" })}>
          {t("viewLog")}
        </Button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-[28px] mt-3.5 mb-0.5">{t("title")}</h1>
      <p className="text-sm text-muted">{setup.name} · {bean.roaster} — {bean.name}</p>
      {weatherSnapshot?.humidityPct != null ? (
        <p className="text-xs text-muted mt-1">
          {t("humidityLine", { temp: weatherSnapshot.tempC ?? "—", humidity: weatherSnapshot.humidityPct })}
        </p>
      ) : null}

      {step === "params" ? (
        <Card>
          <ParamStepper
            label={grindScale.label}
            unit={grindScale.unit}
            value={grindSetting}
            step={grindScale.step}
            min={grindScale.min}
            max={grindScale.max}
            onChange={setGrindSetting}
          />
          <ParamStepper label={t("doseLabel")} unit={t("doseUnit")} value={doseG} step={0.5} min={1} onChange={setDoseG} />
          <ParamStepper
            label={t("targetYieldLabel")}
            unit={t("targetYieldUnit")}
            value={targetYieldG}
            step={1}
            min={1}
            onChange={setTargetYieldG}
          />
          <div className="flex justify-between text-xs text-muted pt-3">
            <span>{t("ratio")}</span>
            <span className="num">1:{computeRatio({ doseG, yieldG: targetYieldG })}</span>
          </div>
          {suggestion && suggestion.reasons.length > 0 ? (
            <Hint>
              <span>
                {t("compassSuggestion", {
                  grind: suggestion.grindSetting,
                  unit: grindScale.unit,
                  reasons: suggestion.reasons.map((r) => r.effect).join(" "),
                })}
              </span>
            </Hint>
          ) : null}
          <Button
            onClick={() => {
              setStep("timer");
              stopwatch.start();
            }}
          >
            {t("startTimer")}
          </Button>
        </Card>
      ) : null}

      {step === "timer" ? (
        <div className="flex flex-col items-center pt-6">
          <TimerRing elapsedS={stopwatch.elapsedS} lapLabel={stopwatch.running ? t("running") : t("stopped")} />
          <div className="w-full mt-6">
            {stopwatch.running ? (
              <Button
                onClick={() => {
                  stopwatch.stop();
                }}
              >
                {t("stop")}
              </Button>
            ) : (
              <>
                <ParamStepper
                  label={t("actualYieldLabel")}
                  unit={t("actualYieldUnit")}
                  value={actualYieldG}
                  step={0.5}
                  min={0}
                  onChange={setActualYieldG}
                />
                <Button onClick={() => setStep("rating")}>{t("continueToRating")}</Button>
              </>
            )}
          </div>
        </div>
      ) : null}

      {step === "rating" ? (
        <Card>
          <RatingSlider label={t("overall")} value={ratingTotal} min={1} max={10} onChange={setRatingTotal} />
          <RatingSlider
            label={t("balance")}
            value={balance}
            min={-5}
            max={5}
            onChange={setBalance}
            bipolarLabels={[t("sour"), t("bitter")]}
          />
          <div className="mt-3">
            <div className="text-xs text-muted mb-2">{t("visual")}</div>
            <div className="flex flex-wrap gap-2">
              {visualTagOptions.map((tag) => (
                <Chip key={tag} active={visualTags.includes(tag)} onClick={() => toggleTag(visualTags, setVisualTags, tag)}>
                  {tag}
                </Chip>
              ))}
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xs text-muted mb-2">{t("aroma")}</div>
            <div className="flex flex-wrap gap-2">
              {flavorTagOptions.map((tag) => (
                <Chip key={tag} active={flavorTags.includes(tag)} onClick={() => toggleTag(flavorTags, setFlavorTags, tag)}>
                  {tag}
                </Chip>
              ))}
            </div>
          </div>
          <Button onClick={finish}>{t("save")}</Button>
        </Card>
      ) : null}
    </div>
  );
}
