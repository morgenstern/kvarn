import { Card, Chart, SectionLabel } from "@kvarn/ui";
import { BookOpen, Star, TrendingUp } from "lucide-react";
import { equipmentProduct, formatGrindValue, useKvarnStore, weatherSnapshotFor } from "../state/store";
import { localeCode, useLocale, useT } from "../i18n";

export function Kompass() {
  const state = useKvarnStore();
  const { brews, equipment, beans, recipes } = state;
  const t = useT("kompass");
  const { locale } = useLocale();

  function equipmentLabel(equipmentId: string | null): string | undefined {
    const eq = equipment.find((e) => e.id === equipmentId);
    if (!eq) return undefined;
    return eq.customName ?? equipmentProduct(state, eq.id)?.model ?? undefined;
  }

  function comboLabel(grinderEquipmentId: string | null, machineEquipmentId: string | null, beanId: string | null): string {
    const parts = [
      equipmentLabel(grinderEquipmentId) ?? t("deletedGrinder"),
      equipmentLabel(machineEquipmentId),
      beans.find((b) => b.id === beanId)?.name ?? t("deletedBean"),
    ].filter((p): p is string => Boolean(p));
    return parts.join(" · ");
  }

  const humidityTimePoints = brews
    .map((b) => {
      const weather = weatherSnapshotFor(state, b.weatherId);
      return weather?.humidityPct != null ? { x: weather.humidityPct, y: b.timeTotalS } : null;
    })
    .filter((p): p is { x: number; y: number } => p !== null);

  const beanAgeRatingPoints = brews
    .filter((b) => b.beanAgeDays != null)
    .map((b) => ({ x: b.beanAgeDays as number, y: b.ratingTotal }));

  return (
    <div>
      <h1 className="font-display text-[32px] mt-3.5 mb-0.5">{t("title")}</h1>
      <p className="text-base text-muted">{t("subtitle")}</p>

      {recipes.length > 0 ? (
        <>
          <SectionLabel icon={Star} className="mt-5">{t("bestRecipes")}</SectionLabel>
          {recipes.map((recipe) => {
            const params = recipe.params as { grindSetting?: number; doseG?: number; targetYieldG?: number } | null;
            return (
              <Card key={recipe.id}>
                <div className="flex items-center justify-between">
                  <div className="text-base font-medium">
                    {comboLabel(recipe.grinderEquipmentId, recipe.machineEquipmentId, recipe.beanId)}
                  </div>
                  <div className="font-display text-xl num">{recipe.avgRating}</div>
                </div>
                <div className="text-sm text-muted mt-1">
                  {t("recipeMeta", {
                    grind:
                      params?.grindSetting !== undefined
                        ? formatGrindValue(state, recipe.grinderEquipmentId, params.grindSetting, locale)
                        : "—",
                    dose: params?.doseG ?? "—",
                    yield: params?.targetYieldG ?? "—",
                    count: recipe.brewCount,
                    confidence: Math.round((recipe.confidence ?? 0) * 100),
                  })}
                </div>
              </Card>
            );
          })}
        </>
      ) : null}

      <SectionLabel icon={TrendingUp} className="mt-5">{t("insights")}</SectionLabel>
      <Card>
        <div className="text-base font-medium mb-1">{t("humidityTime")}</div>
        {humidityTimePoints.length > 0 ? (
          <Chart points={humidityTimePoints} mode="scatter" xAxisLabel={(x) => `${x}%`} />
        ) : (
          <p className="text-sm text-muted">{t("humidityTimeEmpty")}</p>
        )}
      </Card>
      <Card>
        <div className="text-base font-medium mb-1">{t("beanAgeRating")}</div>
        {beanAgeRatingPoints.length > 0 ? (
          <Chart points={beanAgeRatingPoints} mode="scatter" yDomain={[1, 10]} xAxisLabel={(x) => `${x}`} />
        ) : (
          <p className="text-sm text-muted">{t("beanAgeRatingEmpty")}</p>
        )}
      </Card>

      <SectionLabel icon={BookOpen} className="mt-5">{t("logbook")}</SectionLabel>
      {brews.length === 0 ? (
        <Card>
          <p className="text-base">{t("logbookEmpty")}</p>
        </Card>
      ) : (
        <Card className="!p-0">
          {brews.map((b) => (
            <div key={b.id} className="flex items-center gap-3 px-4 py-3 border-b border-linen last:border-b-0">
              <div className="w-9 h-9 rounded-xl bg-birch flex items-center justify-center font-display text-base">
                {b.ratingTotal}
              </div>
              <div className="flex-1">
                <div className="text-base font-medium">
                  {comboLabel(b.grinderEquipmentId, b.machineEquipmentId, b.beanId)}
                </div>
                <div className="text-sm text-muted">
                  {new Date(b.brewedAt).toLocaleString(localeCode(locale))} ·{" "}
                  {t("logRowMeta", {
                    grind: formatGrindValue(state, b.grinderEquipmentId, b.grindSetting, locale),
                    dose: b.doseG,
                    yield: b.actualYieldG ?? b.targetYieldG,
                    time: b.timeTotalS,
                  })}
                </div>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
