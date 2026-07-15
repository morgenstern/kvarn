import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { BarChart3, CheckCircle2, Home } from "lucide-react";
import { Button, Card, Chip, ParamStepper, RatingSlider, SectionLabel } from "@kvarn/ui";
import { equipmentGrindScale, sortedBeans, sortedGrinders, useKvarnStore } from "../state/store";
import { GrinderMachineBeanPicker } from "./GrinderMachineBeanPicker";
import { useGrindSuggestion } from "../hooks/useGrindSuggestion";
import { useLocale, useT, useTags } from "../i18n";
import { beanAgeDaysFor } from "../utils/beanAge";
import { GrindStepper } from "./GrindStepper";

type ManualStep = "pick" | "paramsTime" | "rating";

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Third mode on the Brühen screen ("Nachtragen"/"Log past brew") — logs a
 * brew that already happened, instead of running the live timer. See
 * docs/superpowers/specs/2026-07-05-manual-brew-entry-design.md and
 * docs/superpowers/specs/2026-07-14-remove-setup-concept-design.md. */
export function ManualBrewEntry() {
  const state = useKvarnStore();
  const { commitBrew } = state;
  const { locale } = useLocale();
  const t = useT("bruehen");
  const visualTagOptions = useTags("bruehen", "visualTags");
  const flavorTagOptions = useTags("bruehen", "flavorTags");
  const navigate = useNavigate();

  const grinders = sortedGrinders(state);
  const beans = sortedBeans(state);

  const [manualStep, setManualStep] = useState<ManualStep>("pick");
  const [grinderEquipmentId, setGrinderEquipmentId] = useState(grinders[0]?.id ?? "");
  const [machineEquipmentId, setMachineEquipmentId] = useState<string | null>(null);
  const [beanId, setBeanId] = useState(beans[0]?.id ?? "");
  const [brewedAt, setBrewedAt] = useState(() => new Date().toISOString());
  const [doseG, setDoseG] = useState(18);
  const [targetYieldG, setTargetYieldG] = useState(36);
  const [actualYieldG, setActualYieldG] = useState(36);
  const [timeTotalS, setTimeTotalS] = useState(25);
  const [preinfusion, setPreinfusion] = useState(false);
  const [preinfusionS, setPreinfusionS] = useState(5);
  const [ratingTotal, setRatingTotal] = useState(7);
  const [balance, setBalance] = useState(0);
  const [visualTags, setVisualTags] = useState<string[]>([]);
  const [flavorTags, setFlavorTags] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  const bean = beans.find((b) => b.id === beanId);
  const { grindScale, suggestion } = useGrindSuggestion(state, grinderEquipmentId || null, machineEquipmentId, bean, null);
  const [grindSetting, setGrindSetting] = useState(() => suggestion?.grindSetting ?? equipmentGrindScale(state, grinderEquipmentId || null).min);

  function toggleTag(list: string[], setList: (v: string[]) => void, tag: string) {
    setList(list.includes(tag) ? list.filter((x) => x !== tag) : [...list, tag]);
  }

  async function finish() {
    if (!grinderEquipmentId || !bean) return;
    await commitBrew({
      grinderEquipmentId,
      machineEquipmentId,
      beanId: bean.id,
      weatherId: null,
      brewedAt,
      grindSetting,
      doseG,
      targetYieldG,
      waterTempC: null,
      preinfusionS: preinfusion ? preinfusionS : null,
      puckPrep: null,
      beanAgeDays: beanAgeDaysFor(bean.roastDate, brewedAt),
      timeTotalS,
      timeFirstDropS: null,
      pressureAvgBar: null,
      pressurePeakBar: null,
      actualYieldG,
      flowGs: timeTotalS > 0 ? Math.round((actualYieldG / timeTotalS) * 10) / 10 : null,
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
      isManualEntry: true,
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

  if (manualStep === "pick") {
    return (
      <Card>
        <SectionLabel>{t("manualPickTitle")}</SectionLabel>
        <GrinderMachineBeanPicker
          grinderEquipmentId={grinderEquipmentId}
          machineEquipmentId={machineEquipmentId}
          beanId={beanId}
          onGrinderChange={setGrinderEquipmentId}
          onMachineChange={setMachineEquipmentId}
          onBeanChange={setBeanId}
        />
        <Button disabled={!grinderEquipmentId || !beanId} onClick={() => setManualStep("paramsTime")}>
          {t("next")}
        </Button>
      </Card>
    );
  }

  if (manualStep === "paramsTime") {
    return (
      <Card>
        <div className="flex flex-col gap-0.5 py-[13px] border-b border-linen">
          <label className="text-[13px] text-muted">{t("manualBrewedAt")}</label>
          <input
            type="datetime-local"
            value={toDatetimeLocalValue(brewedAt)}
            onChange={(e) => setBrewedAt(new Date(e.target.value).toISOString())}
            className="border border-linen rounded-control px-3 py-2 text-base bg-birch"
          />
        </div>
        <GrindStepper label={grindScale.label || t("grindLabel")} grindScale={grindScale} value={grindSetting} onChange={setGrindSetting} locale={locale} />
        <ParamStepper label={t("doseLabel")} unit={t("doseUnit")} value={doseG} step={0.5} min={1} onChange={setDoseG} />
        <ParamStepper label={t("targetYieldLabel")} unit={t("targetYieldUnit")} value={targetYieldG} step={1} min={1} onChange={setTargetYieldG} />
        <ParamStepper label={t("actualYieldLabel")} unit={t("actualYieldUnit")} value={actualYieldG} step={0.5} min={0} onChange={setActualYieldG} />
        <ParamStepper label={t("manualTimeTotal")} unit={t("manualTimeUnit")} value={timeTotalS} step={1} min={1} onChange={setTimeTotalS} />
        <div className="flex items-center justify-between py-[13px] border-b border-linen last:border-b-0">
          <div className="text-base">{t("preinfusion")}</div>
          <button
            type="button"
            role="switch"
            aria-checked={preinfusion}
            onClick={() => setPreinfusion((v) => !v)}
            className={`w-11 h-6 rounded-full relative transition-colors ${preinfusion ? "bg-copper" : "bg-linen"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${preinfusion ? "translate-x-5" : ""}`} />
          </button>
        </div>
        {preinfusion ? (
          <ParamStepper label={t("preinfusionDuration")} unit={t("preinfusionUnit")} value={preinfusionS} step={1} min={1} onChange={setPreinfusionS} />
        ) : null}
        <Button onClick={() => setManualStep("rating")}>{t("next")}</Button>
      </Card>
    );
  }

  return (
    <Card>
      <RatingSlider label={t("overall")} value={ratingTotal} min={1} max={10} onChange={setRatingTotal} />
      <RatingSlider label={t("balance")} value={balance} min={-5} max={5} onChange={setBalance} bipolarLabels={[t("sour"), t("bitter")]} />
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
  );
}
