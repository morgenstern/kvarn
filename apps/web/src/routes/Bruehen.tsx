import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button, Card, Chip, EntityImage, Hint, ParamStepper, ProductCard, RatingSlider, RatioViz, SectionLabel, TimerRing, WeatherStrip } from "@kvarn/ui";
import { computeRatio, weatherConditionKey } from "@kvarn/core";
import type { Setup as SetupType, WeatherSnapshot } from "@kvarn/db";
import { BarChart3, CheckCircle2, Coffee, Home, Package, SlidersHorizontal, X } from "lucide-react";
import { activeBean, activeSetup, equipmentKind, equipmentProduct, formatGrindValue, useKvarnStore } from "../state/store";
import { GrindStepper } from "../components/GrindStepper";
import { SetupThumbnail } from "../components/SetupThumbnail";
import { useGrindSuggestion } from "../hooks/useGrindSuggestion";
import { useStopwatch } from "../hooks/useStopwatch";
import { beanAgeDaysFor } from "../utils/beanAge";
import { CONDITION_I18N_KEY } from "../utils/weatherLabels";
import { useLocale, useT, useTags } from "../i18n";

type Step = "params" | "timer" | "rating";
type PickMode = "setup" | "combo";

const METHODS: SetupType["method"][] = ["espresso", "v60", "aeropress", "frenchpress", "moka", "auto"];

export function Bruehen() {
  const state = useKvarnStore();
  const { setups, beans, equipment, activeSetupId, activeBeanId, setActiveSetup, setActiveBean, findOrCreateSetup } = state;
  const setup = activeSetup(state);
  const bean = activeBean(state);
  const commitBrew = useKvarnStore((s) => s.commitBrew);
  const captureWeatherSnapshot = useKvarnStore((s) => s.captureWeatherSnapshot);
  const navigate = useNavigate();
  const stopwatch = useStopwatch();
  const t = useT("bruehen");
  const tHeute = useT("heute");
  const { locale } = useLocale();
  const visualTagOptions = useTags("bruehen", "visualTags");
  const flavorTagOptions = useTags("bruehen", "flavorTags");

  const grinderEquipment = equipment.filter((eq) => equipmentKind(state, eq.id) === "grinder");
  const machineEquipment = equipment.filter((eq) => equipmentKind(state, eq.id) === "machine");

  // "Setup" mode picks a saved setup (which already bundles a mill+machine
  // combo); "combo" mode assembles one from scratch. Assembling a combo
  // doesn't touch global state until confirmed — see confirmCombo() — so
  // just browsing options doesn't spam the setups list with unused rows.
  const [pickMode, setPickMode] = useState<PickMode>("setup");
  const [comboMethod, setComboMethod] = useState<SetupType["method"]>("espresso");
  const [comboGrinderId, setComboGrinderId] = useState("");
  const [comboMachineId, setComboMachineId] = useState("");
  const [comboBeanId, setComboBeanId] = useState("");

  function startCombo() {
    setComboMethod(setup?.method ?? "espresso");
    setComboGrinderId(setup?.grinderEquipmentId ?? grinderEquipment[0]?.id ?? "");
    setComboMachineId(setup?.machineEquipmentId ?? "");
    setComboBeanId(bean?.id ?? "");
    setPickMode("combo");
  }

  async function confirmCombo() {
    if (!comboGrinderId || !comboBeanId) return;
    const resolved = await findOrCreateSetup({
      method: comboMethod,
      grinderEquipmentId: comboGrinderId,
      machineEquipmentId: comboMachineId || null,
      beanId: comboBeanId,
    });
    setActiveSetup(resolved.id);
    setActiveBean(comboBeanId);
    setPickMode("setup");
  }

  const [weatherSnapshot, setWeatherSnapshot] = useState<WeatherSnapshot | null>(null);

  useEffect(() => {
    captureWeatherSnapshot().then(setWeatherSnapshot);
    // Capture once per brew session, on entering the screen — not on every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { grindScale, suggestion } = useGrindSuggestion(state, setup, bean, weatherSnapshot);

  const [step, setStep] = useState<Step>("params");
  const [grindSetting, setGrindSetting] = useState(
    () => suggestion?.grindSetting ?? Math.round(((grindScale.min + grindScale.max) / 2) / grindScale.step) * grindScale.step,
  );

  // Users can switch setup/bean via the pickers below while still on the
  // params step — re-sync the grind default to match whatever is now active
  // instead of leaving it stuck on the first pick's suggestion.
  useEffect(() => {
    if (suggestion) setGrindSetting(suggestion.grindSetting);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup?.id, bean?.id]);
  const [doseG, setDoseG] = useState(18);
  const [targetYieldG, setTargetYieldG] = useState(36);
  const [preinfusion, setPreinfusion] = useState(false);
  const [preinfusionS, setPreinfusionS] = useState(5);
  const [actualYieldG, setActualYieldG] = useState(36);
  const [ratingTotal, setRatingTotal] = useState(7);
  const [balance, setBalance] = useState(0);
  const [visualTags, setVisualTags] = useState<string[]>([]);
  const [flavorTags, setFlavorTags] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  if (!setup || !bean) {
    return (
      <div>
        <h1 className="font-display text-[32px] mt-3.5 mb-0.5">{t("title")}</h1>
        <Card>
          <p className="text-base">{t("needsSetupAndBean")}</p>
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
      preinfusionS: preinfusion ? preinfusionS : null,
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
      isManualEntry: false,
      recipeId: null,
    });
    setSaved(true);
  }

  if (saved) {
    return (
      <div>
        <h1 className="flex items-center gap-2 font-display text-[32px] mt-3.5 mb-0.5">
          <CheckCircle2 className="text-sage" size={28} strokeWidth={1.5} />
          {t("savedTitle")}
        </h1>
        <p className="text-base text-muted">{t("savedSubtitle")}</p>
        <Button onClick={() => navigate({ to: "/" })}>
          <Home size={18} strokeWidth={1.5} />
          {t("backToToday")}
        </Button>
        <Button variant="ghost" onClick={() => navigate({ to: "/kompass" })}>
          <BarChart3 size={18} strokeWidth={1.5} />
          {t("viewLog")}
        </Button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-[32px] mt-3.5 mb-0.5">{t("title")}</h1>
      <p className="text-base text-muted">{setup.name} · {bean.roaster} — {bean.name}</p>
      {weatherSnapshot ? (
        <WeatherStrip
          className="mt-3"
          tempC={weatherSnapshot.tempC}
          humidityPct={weatherSnapshot.humidityPct}
          pressureHpa={weatherSnapshot.pressureHpa}
          condition={tHeute(CONDITION_I18N_KEY[weatherConditionKey(weatherSnapshot.weatherCode)] ?? "condUnknown")}
          humidityLabel={tHeute("weatherHumidity")}
          pressureLabel={tHeute("weatherPressure")}
        />
      ) : null}

      {step === "params" ? (
        <>
          <div className="flex gap-2 mt-5">
            <Chip active={pickMode === "setup"} onClick={() => setPickMode("setup")}>
              {t("modeSetup")}
            </Chip>
            <Chip active={pickMode === "combo"} onClick={startCombo}>
              {t("modeCombo")}
            </Chip>
          </div>

          {pickMode === "setup" ? (
            <div className="flex gap-3 overflow-x-auto pb-1 -mx-5 px-5 mt-3">
              {setups.map((s) => (
                <ProductCard
                  key={s.id}
                  className="w-28 flex-none"
                  active={activeSetupId === s.id}
                  onClick={() => setActiveSetup(s.id)}
                  image={<SetupThumbnail setup={s} />}
                >
                  <div className="text-[13px] font-medium leading-tight truncate">{s.name}</div>
                </ProductCard>
              ))}
            </div>
          ) : (
            <>
              <SectionLabel className="mt-5">{t("pickMethod")}</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {METHODS.map((m) => (
                  <Chip key={m} active={comboMethod === m} onClick={() => setComboMethod(m)}>
                    {m}
                  </Chip>
                ))}
              </div>

              <SectionLabel icon={SlidersHorizontal} className="mt-5">{t("pickGrinder")}</SectionLabel>
              <div className="flex gap-3 overflow-x-auto pb-1 -mx-5 px-5">
                {grinderEquipment.map((eq) => (
                  <ProductCard
                    key={eq.id}
                    className="w-28 flex-none"
                    active={comboGrinderId === eq.id}
                    onClick={() => setComboGrinderId(eq.id)}
                    image={<EntityImage src={equipmentProduct(state, eq.id)?.imageUrl} kind="grinder" className="w-full h-full" />}
                  >
                    <div className="text-[13px] font-medium leading-tight truncate">
                      {eq.customName ?? equipmentProduct(state, eq.id)?.model ?? "—"}
                    </div>
                  </ProductCard>
                ))}
              </div>

              <SectionLabel icon={Coffee} className="mt-5">{t("pickMachine")}</SectionLabel>
              <div className="flex gap-3 overflow-x-auto pb-1 -mx-5 px-5">
                <ProductCard
                  className="w-28 flex-none"
                  active={comboMachineId === ""}
                  onClick={() => setComboMachineId("")}
                  image={
                    <div className="w-full h-full flex items-center justify-center text-muted">
                      <X size={28} strokeWidth={1.5} />
                    </div>
                  }
                >
                  <div className="text-[13px] font-medium leading-tight truncate">{t("noMachine")}</div>
                </ProductCard>
                {machineEquipment.map((eq) => (
                  <ProductCard
                    key={eq.id}
                    className="w-28 flex-none"
                    active={comboMachineId === eq.id}
                    onClick={() => setComboMachineId(eq.id)}
                    image={<EntityImage src={equipmentProduct(state, eq.id)?.imageUrl} kind="machine" className="w-full h-full" />}
                  >
                    <div className="text-[13px] font-medium leading-tight truncate">
                      {eq.customName ?? equipmentProduct(state, eq.id)?.model ?? "—"}
                    </div>
                  </ProductCard>
                ))}
              </div>

              <SectionLabel icon={Package} className="mt-5">{t("pickBean")}</SectionLabel>
              <div className="flex gap-3 overflow-x-auto pb-1 -mx-5 px-5">
                {beans.map((b) => (
                  <ProductCard
                    key={b.id}
                    className="w-28 flex-none"
                    active={comboBeanId === b.id}
                    onClick={() => setComboBeanId(b.id)}
                    image={<EntityImage src={b.imageUrl ?? b.photoUrl} kind="bean" className="w-full h-full" />}
                  >
                    <div className="text-[13px] font-medium leading-tight truncate">{b.roaster}</div>
                  </ProductCard>
                ))}
              </div>

              <Button disabled={!comboGrinderId || !comboBeanId} onClick={confirmCombo}>
                {t("comboConfirm")}
              </Button>
            </>
          )}

          {pickMode === "setup" ? (
            <>
              <SectionLabel icon={Package} className="mt-5">{t("pickBean")}</SectionLabel>
              <div className="flex gap-3 overflow-x-auto pb-1 -mx-5 px-5">
                {beans.map((b) => (
                  <ProductCard
                    key={b.id}
                    className="w-28 flex-none"
                    active={activeBeanId === b.id}
                    onClick={() => setActiveBean(b.id)}
                    image={<EntityImage src={b.imageUrl ?? b.photoUrl} kind="bean" className="w-full h-full" />}
                  >
                    <div className="text-[13px] font-medium leading-tight truncate">{b.roaster}</div>
                  </ProductCard>
                ))}
              </div>
            </>
          ) : null}
        </>
      ) : null}

      {step === "params" ? (
        <Card>
          <GrindStepper
            label={grindScale.label || t("grindLabel")}
            grindScale={grindScale}
            value={grindSetting}
            onChange={setGrindSetting}
            locale={locale}
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
          <div className="flex items-center justify-between py-[13px] border-b border-linen last:border-b-0">
            <div className="text-base">{t("preinfusion")}</div>
            <button
              type="button"
              role="switch"
              aria-checked={preinfusion}
              onClick={() => setPreinfusion((v) => !v)}
              className={`w-11 h-6 rounded-full relative transition-colors ${preinfusion ? "bg-copper" : "bg-linen"}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${preinfusion ? "translate-x-5" : ""}`}
              />
            </button>
          </div>
          {preinfusion ? (
            <ParamStepper
              label={t("preinfusionDuration")}
              unit={t("preinfusionUnit")}
              value={preinfusionS}
              step={1}
              min={1}
              onChange={setPreinfusionS}
            />
          ) : null}
          <div className="flex justify-between text-sm text-muted pt-3">
            <span>{t("ratio")}</span>
            <span className="num">1:{computeRatio({ doseG, yieldG: targetYieldG })}</span>
          </div>
          <RatioViz
            className="mt-2"
            doseG={doseG}
            yieldG={targetYieldG}
            doseLabel={`${t("doseLabel")} ${doseG}g`}
            yieldLabel={`${targetYieldG}g ${t("targetYieldLabel")}`}
          />
          {suggestion && suggestion.reasons.length > 0 ? (
            <Hint>
              <span>
                {t("compassSuggestion", {
                  grind: formatGrindValue(state, setup?.grinderEquipmentId ?? null, suggestion.grindSetting, locale),
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
          <div className="flex items-center gap-3 mb-6">
            <div className="flex flex-col items-center gap-1">
              <EntityImage
                src={equipmentProduct(state, setup.grinderEquipmentId)?.imageUrl}
                kind={equipmentKind(state, setup.grinderEquipmentId)}
                className="w-14 h-14 rounded-control"
              />
              <span className="text-[11px] text-muted">{t("pickGrinder")}</span>
            </div>
            {setup.machineEquipmentId ? (
              <div className="flex flex-col items-center gap-1">
                <EntityImage
                  src={equipmentProduct(state, setup.machineEquipmentId)?.imageUrl}
                  kind="machine"
                  className="w-14 h-14 rounded-control"
                />
                <span className="text-[11px] text-muted">{t("pickMachine")}</span>
              </div>
            ) : null}
            <div className="flex flex-col items-center gap-1">
              <EntityImage src={bean.imageUrl ?? bean.photoUrl} kind="bean" className="w-14 h-14 rounded-control" />
              <span className="text-[11px] text-muted">{t("pickBean")}</span>
            </div>
          </div>
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
            <div className="text-sm text-muted mb-2">{t("visual")}</div>
            <div className="flex flex-wrap gap-2">
              {visualTagOptions.map((tag) => (
                <Chip key={tag} active={visualTags.includes(tag)} onClick={() => toggleTag(visualTags, setVisualTags, tag)}>
                  {tag}
                </Chip>
              ))}
            </div>
          </div>
          <div className="mt-3">
            <div className="text-sm text-muted mb-2">{t("aroma")}</div>
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
