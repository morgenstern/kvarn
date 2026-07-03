import { Card } from "@kvarn/ui";
import { useKvarnStore } from "../state/store";

export function Kompass() {
  const { brews, setups, beans } = useKvarnStore();

  return (
    <div>
      <h1 className="font-display text-[28px] mt-3.5 mb-0.5">Kompass</h1>
      <p className="text-sm text-muted">
        Logbuch aller Bezüge. Insights & Empfehlungen folgen mit dem Kompass-Regelwerk (M2).
      </p>

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
