import { Link } from "@tanstack/react-router";
import { Button, Card, EntityImage, Hint, ProductCard, SectionLabel, WeatherStrip } from "@kvarn/ui";
import { Clock, Package, SlidersHorizontal } from "lucide-react";
import { weatherConditionKey } from "@kvarn/core";
import { activeBean, activeSetup, formatGrindValue, latestWeatherSnapshot, useKvarnStore } from "../state/store";
import { SetupThumbnail } from "../components/SetupThumbnail";
import { useGrindSuggestion } from "../hooks/useGrindSuggestion";
import { useDisplayName } from "../hooks/useDisplayName";
import { greetingWord } from "../utils/greeting";
import { CONDITION_I18N_KEY } from "../utils/weatherLabels";
import { localeCode, useLocale, useT } from "../i18n";

export function Heute() {
  const state = useKvarnStore();
  const { setups, beans, activeSetupId, activeBeanId, setActiveSetup, setActiveBean } = state;
  const setup = activeSetup(state);
  const bean = activeBean(state);
  const recentBrews = state.brews.slice(0, 3);
  const t = useT("heute");
  const { locale } = useLocale();
  const { displayName } = useDisplayName();
  const weatherSnapshot = latestWeatherSnapshot(state);
  const { suggestion } = useGrindSuggestion(state, setup, bean, weatherSnapshot);

  const dateLabel = new Date().toLocaleDateString(localeCode(locale), { weekday: "long", day: "numeric", month: "long" });
  const greeting = `${greetingWord()}, ${displayName || t("greetingFallbackName")}`;

  // RootLayout guarantees at least one setup+bean exist before this screen is
  // even reachable; this only covers the edge case where none is *active*
  // right now (e.g. the active one was archived).
  if (!setup || !bean) {
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

      <p className="text-base text-muted mt-3">{setup.name} · {bean.roaster} — {bean.name}</p>

      <SectionLabel icon={SlidersHorizontal} className="mt-5">{t("grinderLabel")}</SectionLabel>
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-5 px-5">
        {setups.map((s) => (
          <ProductCard
            key={s.id}
            className="w-32 flex-none"
            active={activeSetupId === s.id}
            onClick={() => setActiveSetup(s.id)}
            image={<SetupThumbnail setup={s} />}
          >
            <div className="text-[14px] font-medium leading-tight truncate">{s.name}</div>
            <div className="text-[12px] text-muted truncate">{s.method}</div>
          </ProductCard>
        ))}
      </div>

      <SectionLabel icon={Package} className="mt-5">{t("beanWord")}</SectionLabel>
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-5 px-5">
        {beans.map((b) => (
          <ProductCard
            key={b.id}
            className="w-32 flex-none"
            active={activeBeanId === b.id}
            onClick={() => setActiveBean(b.id)}
            image={<EntityImage src={b.imageUrl ?? b.photoUrl} kind="bean" className="w-full h-full" />}
          >
            <div className="text-[14px] font-medium leading-tight truncate">{b.roaster}</div>
            <div className="text-[12px] text-muted truncate">{b.name}</div>
          </ProductCard>
        ))}
      </div>

      {suggestion && suggestion.reasons.length > 0 ? (
        <Hint>
          <span>
            <b>{t("compassPreview")}:</b> {suggestion.reasons.map((r) => r.effect).join(" ")}
          </span>
        </Hint>
      ) : null}

      <Link to="/bruehen">
        <Button>{t("brewStart")}</Button>
      </Link>

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
                  {formatGrindValue(state, setups.find((s) => s.id === b.setupId)?.grinderEquipmentId ?? null, b.grindSetting, locale)} · {b.doseG}g → {b.actualYieldG ?? b.targetYieldG}g
                </div>
              </div>
            </div>
          ))}
        </Card>
      ) : null}
    </div>
  );
}
