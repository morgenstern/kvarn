import { useParams } from "@tanstack/react-router";
import { Card, Chart } from "@kvarn/ui";
import { computeBeanAgeDays, freshnessPct, FRESHNESS_PEAK_WINDOW_DAYS } from "@kvarn/core";
import { useKvarnStore } from "../state/store";

const FRESHNESS_CURVE_MAX_DAYS = 50;

export function BeanDetail() {
  const { beanId } = useParams({ from: "/regal/$beanId" });
  const { beans, brews, setups, recipes } = useKvarnStore();
  const bean = beans.find((b) => b.id === beanId);

  if (!bean) {
    return (
      <div>
        <h1 className="font-display text-[28px] mt-3.5 mb-0.5">Bohne nicht gefunden</h1>
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

  return (
    <div>
      <h1 className="font-display text-[28px] mt-3.5 mb-0.5">{bean.name}</h1>
      <p className="text-sm text-muted">{bean.roaster}{bean.origin ? ` · ${bean.origin}` : ""}</p>

      {bean.photoUrl ? <img src={bean.photoUrl} alt="" className="w-full h-40 object-cover rounded-card mt-3" /> : null}

      <Card>
        <div className="text-[11px] uppercase tracking-wider text-muted font-medium mb-2">Stammdaten</div>
        <div className="flex justify-between text-sm py-1">
          <span className="text-muted">Röstdatum</span>
          <span>{bean.roastDate ? new Date(bean.roastDate).toLocaleDateString("de-DE") : "unbekannt"}</span>
        </div>
        <div className="flex justify-between text-sm py-1">
          <span className="text-muted">Bohnenalter</span>
          <span>{ageDays !== null ? `${ageDays} Tage` : "—"}</span>
        </div>
      </Card>

      {bean.roastDate ? (
        <Card>
          <div className="text-[11px] uppercase tracking-wider text-muted font-medium mb-2">Frische-Kurve</div>
          <Chart
            points={freshnessCurvePoints}
            mode="line"
            xDomain={[0, FRESHNESS_CURVE_MAX_DAYS]}
            yDomain={[0, 100]}
            targetBand={[
              freshnessPct(FRESHNESS_PEAK_WINDOW_DAYS[1]),
              freshnessPct(FRESHNESS_PEAK_WINDOW_DAYS[0]),
            ]}
            xAxisLabel={(x) => `Tag ${x}`}
          />
        </Card>
      ) : null}

      {ratingHistoryPoints.length > 0 ? (
        <Card>
          <div className="text-[11px] uppercase tracking-wider text-muted font-medium mb-2">Rating-Verlauf</div>
          <Chart
            points={ratingHistoryPoints}
            mode="scatter"
            yDomain={[1, 10]}
            xAxisLabel={(x) => new Date(x).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
          />
        </Card>
      ) : null}

      {beanRecipes.length > 0 ? (
        <Card>
          <div className="text-[11px] uppercase tracking-wider text-muted font-medium mb-2">Rezepte</div>
          {beanRecipes.map((recipe) => {
            const setup = setups.find((s) => s.id === recipe.setupId);
            const params = recipe.params as { grindSetting?: number; doseG?: number; targetYieldG?: number } | null;
            return (
              <div key={recipe.id} className="flex justify-between text-sm py-1.5 border-b border-linen last:border-b-0">
                <span>{setup?.name ?? "Setup gelöscht"}</span>
                <span className="text-muted">
                  Mahlgrad {params?.grindSetting} · {recipe.avgRating} ⌀ · {recipe.brewCount}x
                </span>
              </div>
            );
          })}
        </Card>
      ) : null}
    </div>
  );
}
