import { useParams } from "@tanstack/react-router";
import { Card, Chart, EntityImage, SectionLabel } from "@kvarn/ui";
import { computeBeanAgeDays, freshnessPct, FRESHNESS_PEAK_WINDOW_DAYS } from "@kvarn/core";
import { Activity, FlaskConical, Info, Star } from "lucide-react";
import { useKvarnStore } from "../state/store";
import { localeCode, useLocale, useT } from "../i18n";

const FRESHNESS_CURVE_MAX_DAYS = 50;

export function BeanDetail() {
  const { beanId } = useParams({ from: "/regal/$beanId" });
  const { beans, brews, setups, recipes } = useKvarnStore();
  const bean = beans.find((b) => b.id === beanId);
  const t = useT("beanDetail");
  const tKompass = useT("kompass");
  const { locale } = useLocale();

  if (!bean) {
    return (
      <div>
        <h1 className="font-display text-[32px] mt-3.5 mb-0.5">{t("notFound")}</h1>
      </div>
    );
  }

  const beanBrews = brews.filter((b) => b.beanId === bean.id).sort((a, b) => a.brewedAt.localeCompare(b.brewedAt));
  const beanRecipes = recipes.filter((r) => r.beanId === bean.id);
  const ageDays = bean.roastDate ? computeBeanAgeDays(new Date(bean.roastDate), new Date()) : null;

  const freshnessCurvePoints = Array.from({ length: FRESHNESS_CURVE_MAX_DAYS + 1 }, (_, day) => ({
    x: day,
    y: freshnessPct(day),
  }));

  const ratingHistoryPoints = beanBrews.map((b) => ({
    x: new Date(b.brewedAt).getTime(),
    y: b.ratingTotal,
  }));

  const dateLocale = localeCode(locale);

  return (
    <div>
      <h1 className="font-display text-[32px] mt-3.5 mb-0.5">{bean.name}</h1>
      <p className="text-base text-muted">{bean.roaster}{bean.origin ? ` · ${bean.origin}` : ""}</p>

      {bean.photoUrl ? (
        <img src={bean.photoUrl} alt="" className="w-full h-40 object-cover rounded-card mt-3" />
      ) : (
        <EntityImage kind="bean" className="w-24 h-24 mt-3" />
      )}

      <Card>
        <SectionLabel icon={Info}>{t("stammdaten")}</SectionLabel>
        <div className="flex justify-between text-base py-1">
          <span className="text-muted">{t("roastDate")}</span>
          <span>{bean.roastDate ? new Date(bean.roastDate).toLocaleDateString(dateLocale) : t("unknown")}</span>
        </div>
        <div className="flex justify-between text-base py-1">
          <span className="text-muted">{t("beanAge")}</span>
          <span>{ageDays !== null ? t("daysUnit", { count: ageDays }) : "—"}</span>
        </div>
      </Card>

      {bean.roastDate ? (
        <Card>
          <SectionLabel icon={Activity}>{t("freshnessCurve")}</SectionLabel>
          <Chart
            points={freshnessCurvePoints}
            mode="line"
            xDomain={[0, FRESHNESS_CURVE_MAX_DAYS]}
            yDomain={[0, 100]}
            targetBand={[
              freshnessPct(FRESHNESS_PEAK_WINDOW_DAYS[1]),
              freshnessPct(FRESHNESS_PEAK_WINDOW_DAYS[0]),
            ]}
            xAxisLabel={(x) => t("dayLabel", { day: x })}
          />
        </Card>
      ) : null}

      {ratingHistoryPoints.length > 0 ? (
        <Card>
          <SectionLabel icon={Star}>{t("ratingHistory")}</SectionLabel>
          <Chart
            points={ratingHistoryPoints}
            mode="scatter"
            yDomain={[1, 10]}
            xAxisLabel={(x) => new Date(x).toLocaleDateString(dateLocale, { day: "2-digit", month: "2-digit" })}
          />
        </Card>
      ) : null}

      {beanRecipes.length > 0 ? (
        <Card>
          <SectionLabel icon={FlaskConical}>{t("recipes")}</SectionLabel>
          {beanRecipes.map((recipe) => {
            const setup = setups.find((s) => s.id === recipe.setupId);
            const params = recipe.params as { grindSetting?: number; doseG?: number; targetYieldG?: number } | null;
            return (
              <div key={recipe.id} className="flex justify-between text-base py-1.5 border-b border-linen last:border-b-0">
                <span>{setup?.name ?? tKompass("deletedSetup")}</span>
                <span className="text-muted">
                  {t("recipeLine", {
                    grind: params?.grindSetting ?? "—",
                    avg: recipe.avgRating ?? "—",
                    count: recipe.brewCount,
                  })}
                </span>
              </div>
            );
          })}
        </Card>
      ) : null}
    </div>
  );
}
