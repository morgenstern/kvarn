import { Link } from "@tanstack/react-router";
import { Button, Card } from "@kvarn/ui";
import { activeBean, activeSetup, equipmentProduct, useKvarnStore } from "../state/store";

export function Heute() {
  const state = useKvarnStore();
  const setup = activeSetup(state);
  const bean = activeBean(state);
  const grinder = equipmentProduct(state, setup?.grinderEquipmentId ?? null);
  const recentBrews = state.brews.slice(0, 3);

  if (!setup || !bean) {
    return (
      <div>
        <h1 className="font-display text-[28px] mt-3.5 mb-0.5">Heute</h1>
        <p className="text-sm text-muted">Noch kein Setup oder keine Bohne angelegt.</p>
        <Card>
          <p className="text-sm">
            Leg zuerst ein <Link to="/setup" className="text-copper underline">Setup</Link> und eine{" "}
            <Link to="/regal" className="text-copper underline">Bohne</Link> an, dann kann's losgehen.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-[28px] mt-3.5 mb-0.5">Heute</h1>
      <p className="text-sm text-muted">{setup.name} · {bean.roaster} — {bean.name}</p>

      <Card>
        <div className="text-[11px] uppercase tracking-wider text-muted font-medium">Bereit für den nächsten Bezug</div>
        <div className="flex justify-between mt-2 text-sm">
          <span>Mühle</span>
          <span className="text-espresso">{grinder ? `${grinder.brand} ${grinder.model}` : "Eigenes Gerät"}</span>
        </div>
        <div className="flex justify-between mt-1 text-sm">
          <span>Methode</span>
          <span className="text-espresso">{setup.method}</span>
        </div>
        <Link to="/bruehen">
          <Button>Brew starten</Button>
        </Link>
      </Card>

      {recentBrews.length > 0 ? (
        <Card>
          <div className="text-[11px] uppercase tracking-wider text-muted font-medium mb-2">Letzte Bezüge</div>
          {recentBrews.map((b) => (
            <div key={b.id} className="flex items-center gap-3 py-2 border-b border-linen last:border-b-0">
              <div className="w-9 h-9 rounded-xl bg-birch flex items-center justify-center font-display text-sm">
                {b.ratingTotal}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">{new Date(b.brewedAt).toLocaleDateString("de-DE")}</div>
                <div className="text-xs text-muted">{b.grindSetting} · {b.doseG}g → {b.actualYieldG ?? b.targetYieldG}g</div>
              </div>
            </div>
          ))}
        </Card>
      ) : null}
    </div>
  );
}
