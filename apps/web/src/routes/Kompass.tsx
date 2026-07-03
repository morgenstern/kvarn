import { Card, Chart } from "@kvarn/ui";
import { useKvarnStore, weatherSnapshotFor } from "../state/store";

export function Kompass() {
  const state = useKvarnStore();
  const { brews, setups, beans, recipes } = state;

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
      <h1 className="font-display text-[28px] mt-3.5 mb-0.5">Kompass</h1>
      <p className="text-sm text-muted">Deine besten Rezepte, Insights und das Logbuch aller Bezüge.</p>

      {recipes.length > 0 ? (
        <>
          <div className="text-[11px] uppercase tracking-wider text-muted font-medium mt-5 mb-1">
            Deine besten Rezepte
          </div>
          {recipes.map((recipe) => {
            const setup = setups.find((s) => s.id === recipe.setupId);
            const bean = beans.find((b) => b.id === recipe.beanId);
            const params = recipe.params as { grindSetting?: number; doseG?: number; targetYieldG?: number } | null;
            return (
              <Card key={recipe.id}>
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">
                    {setup?.name ?? "Setup gelöscht"} · {bean?.name ?? "Bohne gelöscht"}
                  </div>
                  <div className="font-display text-lg num">{recipe.avgRating}</div>
                </div>
                <div className="text-xs text-muted mt-1">
                  Mahlgrad {params?.grindSetting} · {params?.doseG}g → {params?.targetYieldG}g · {recipe.brewCount}{" "}
                  Bezüge · Konfidenz {Math.round((recipe.confidence ?? 0) * 100)}%
                </div>
              </Card>
            );
          })}
        </>
      ) : null}

      <div className="text-[11px] uppercase tracking-wider text-muted font-medium mt-5 mb-1">Insights</div>
      <Card>
        <div className="text-sm font-medium mb-1">Luftfeuchte × Brühzeit</div>
        {humidityTimePoints.length > 0 ? (
          <Chart points={humidityTimePoints} mode="scatter" xAxisLabel={(x) => `${x}%`} />
        ) : (
          <p className="text-xs text-muted">
            Noch keine Bezüge mit Wetter-Snapshot. Standort-Freigabe beim Brühen erlauben, um hier Muster zu sehen.
          </p>
        )}
      </Card>
      <Card>
        <div className="text-sm font-medium mb-1">Bohnenalter × Rating</div>
        {beanAgeRatingPoints.length > 0 ? (
          <Chart points={beanAgeRatingPoints} mode="scatter" yDomain={[1, 10]} xAxisLabel={(x) => `Tag ${x}`} />
        ) : (
          <p className="text-xs text-muted">Noch keine Bezüge mit bekanntem Röstdatum.</p>
        )}
      </Card>

      <div className="text-[11px] uppercase tracking-wider text-muted font-medium mt-5 mb-1">Logbuch</div>
      {brews.length === 0 ? (
        <Card>
          <p className="text-sm">Noch keine Bezüge getrackt. Starte deinen ersten Brew.</p>
        </Card>
      ) : (
        <Card className="!p-0">
          {brews.map((b) => {
            const setup = setups.find((s) => s.id === b.setupId);
            const bean = beans.find((be) => be.id === b.beanId);
            return (
              <div key={b.id} className="flex items-center gap-3 px-4 py-3 border-b border-linen last:border-b-0">
                <div className="w-9 h-9 rounded-xl bg-birch flex items-center justify-center font-display text-sm">
                  {b.ratingTotal}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">
                    {setup?.name ?? "Setup gelöscht"} · {bean?.name ?? "Bohne gelöscht"}
                  </div>
                  <div className="text-xs text-muted">
                    {new Date(b.brewedAt).toLocaleString("de-DE")} · Mahlgrad {b.grindSetting} · {b.doseG}g →{" "}
                    {b.actualYieldG ?? b.targetYieldG}g · {b.timeTotalS}s
                  </div>
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
