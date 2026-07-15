import { Link } from "@tanstack/react-router";
import { Button, Card, EntityImage, Hint, SectionLabel, WeatherStrip } from "@kvarn/ui";
import { Clock } from "lucide-react";
import { weatherConditionKey } from "@kvarn/core";
import { equipmentProduct, formatGrindValue, lastUsedCombo, latestWeatherSnapshot, useKvarnStore } from "../state/store";
import { useGrindSuggestion } from "../hooks/useGrindSuggestion";
import { useDisplayName } from "../hooks/useDisplayName";
import { greetingWord } from "../utils/greeting";
import { CONDITION_I18N_KEY } from "../utils/weatherLabels";
import { localeCode, useLocale, useT } from "../i18n";

export function Heute() {
  const state = useKvarnStore();
  const { equipment, beans } = state;
  const combo = lastUsedCombo(state);
  const grinder = equipment.find((e) => e.id === combo.grinderEquipmentId);
  const machine = equipment.find((e) => e.id === combo.machineEquipmentId);
  const bean = beans.find((b) => b.id === combo.beanId);
  const recentBrews = state.brews.slice(0, 3);
  const t = useT("heute");
  const { locale } = useLocale();
  const { displayName } = useDisplayName();
  const weatherSnapshot = latestWeatherSnapshot(state);
  const { suggestion } = useGrindSuggestion(state, combo.grinderEquipmentId, combo.machineEquipmentId, bean, weatherSnapshot);

  const dateLabel = new Date().toLocaleDateString(localeCode(locale), { weekday: "long", day: "numeric", month: "long" });
  const greeting = `${greetingWord()}, ${displayName || t("greetingFallbackName")}`;

  // RootLayout guarantees at least one grinder and one bean exist before this
  // screen is even reachable; this only covers the edge case where no brew
  // has ever happened yet (nothing to build a "ready for your next brew"
  // card from).
  if (!grinder || !bean) {
    return (
      <div>
        <p className="text-sm text-muted mt-3.5">{dateLabel}</p>
        <h1 className="font-display text-[32px] mb-0.5">{greeting}</h1>
        <p className="text-base text-muted">{t("emptyHint")}</p>
        <Card>
          <p className="text-base">
            {t("emptyBefore")}
            <Link to="/setup" className="text-copper underline">
              {t("setupWord")}
            </Link>
            {t("emptyMid")}
            <Link to="/regal" className="text-copper underline">
              {t("beanWord")}
            </Link>
            {t("emptyAfter")}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-muted mt-3.5">{dateLabel}</p>
      <h1 className="font-display text-[32px] mb-0.5">{greeting}</h1>

      {weatherSnapshot ? (
        <WeatherStrip
          className="mt-3"
          tempC={weatherSnapshot.tempC}
          humidityPct={weatherSnapshot.humidityPct}
          pressureHpa={weatherSnapshot.pressureHpa}
          condition={t(CONDITION_I18N_KEY[weatherConditionKey(weatherSnapshot.weatherCode)] ?? "condUnknown")}
          humidityLabel={t("weatherHumidity")}
          pressureLabel={t("weatherPressure")}
        />
      ) : null}

      <Card className="mt-3">
        {(() => {
          const grinderProduct = equipmentProduct(state, grinder.id);
          const machineProduct = machine ? equipmentProduct(state, machine.id) : undefined;
          return (
            <div className="flex items-center gap-3">
              <EntityImage src={grinderProduct?.imageUrl} kind="grinder" className="w-14 h-14 rounded-control flex-none" />
              {machine ? (
                <EntityImage src={machineProduct?.imageUrl} kind="machine" className="w-14 h-14 rounded-control flex-none" />
              ) : null}
              <EntityImage src={bean.imageUrl ?? bean.photoUrl} kind="bean" className="w-14 h-14 rounded-control flex-none" />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-muted">{t("readyCard")}</div>
                <div className="text-base font-medium truncate">
                  {grinder.customName ?? grinderProduct?.model ?? "—"}
                  {machine ? ` · ${machine.customName ?? machineProduct?.model ?? "—"}` : ""}
                  {" · "}
                  {bean.roaster}
                </div>
              </div>
            </div>
          );
        })()}

        {suggestion && suggestion.reasons.length > 0 ? (
          <Hint className="mt-3">
            <span>
              <b>{t("compassPreview")}:</b> {suggestion.reasons.map((r) => r.effect).join(" ")}
            </span>
          </Hint>
        ) : null}

        <Link to="/bruehen">
          <Button>{t("brewStart")}</Button>
        </Link>
      </Card>

      {recentBrews.length > 0 ? (
        <Card>
          <SectionLabel icon={Clock}>{t("recentBrews")}</SectionLabel>
          {recentBrews.map((b) => (
            <div key={b.id} className="flex items-center gap-3 py-2 border-b border-linen last:border-b-0">
              <div className="w-9 h-9 rounded-xl bg-birch flex items-center justify-center font-display text-base">
                {b.ratingTotal}
              </div>
              <div className="flex-1">
                <div className="text-base font-medium">{new Date(b.brewedAt).toLocaleDateString(localeCode(locale))}</div>
                <div className="text-sm text-muted">
                  {formatGrindValue(state, b.grinderEquipmentId, b.grindSetting, locale)} · {b.doseG}g → {b.actualYieldG ?? b.targetYieldG}g
                </div>
              </div>
            </div>
          ))}
        </Card>
      ) : null}
    </div>
  );
}
