import { useState } from "react";
import { Button, Card } from "@kvarn/ui";
import { useKvarnStore } from "../state/store";

function freshnessPct(roastDate: string | null): number | null {
  if (!roastDate) return null;
  const days = Math.floor((Date.now() - new Date(roastDate).getTime()) / 86_400_000);
  // Rough curve: peak freshness days 4-21, tapering off by day 45.
  if (days < 0) return 0;
  if (days <= 21) return 100;
  const decay = Math.max(0, 100 - ((days - 21) / 24) * 100);
  return Math.round(decay);
}

export function Regal() {
  const { beans, addBean, archiveBean, activeBeanId, setActiveBean } = useKvarnStore();
  const [showForm, setShowForm] = useState(false);
  const [roaster, setRoaster] = useState("");
  const [name, setName] = useState("");
  const [origin, setOrigin] = useState("");
  const [roastDate, setRoastDate] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!roaster || !name) return;
    await addBean({ roaster, name, origin: origin || undefined, roastDate: roastDate || undefined });
    setRoaster("");
    setName("");
    setOrigin("");
    setRoastDate("");
    setShowForm(false);
  }

  return (
    <div>
      <h1 className="font-display text-[28px] mt-3.5 mb-0.5">Regal</h1>
      <p className="text-sm text-muted">
        {beans.length === 0 ? "Noch keine Beans im Regal. Zeit für einen Röster-Besuch." : `${beans.length} Bohne(n)`}
      </p>

      {showForm ? (
        <Card>
          <form onSubmit={submit} className="flex flex-col gap-3">
            <input
              className="border border-linen rounded-control px-3 py-2 text-sm bg-birch"
              placeholder="Röster"
              value={roaster}
              onChange={(e) => setRoaster(e.target.value)}
              required
            />
            <input
              className="border border-linen rounded-control px-3 py-2 text-sm bg-birch"
              placeholder="Name / Sorte"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <input
              className="border border-linen rounded-control px-3 py-2 text-sm bg-birch"
              placeholder="Herkunft (optional)"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
            />
            <label className="text-xs text-muted -mb-2">Röstdatum</label>
            <input
              type="date"
              className="border border-linen rounded-control px-3 py-2 text-sm bg-birch"
              value={roastDate}
              onChange={(e) => setRoastDate(e.target.value)}
            />
            <Button type="submit">Bohne speichern</Button>
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
              Abbrechen
            </Button>
          </form>
        </Card>
      ) : (
        <Button onClick={() => setShowForm(true)}>+ Bohne hinzufügen</Button>
      )}

      {beans.map((bean) => {
        const fresh = freshnessPct(bean.roastDate);
        return (
          <Card
            key={bean.id}
            className={`cursor-pointer ${activeBeanId === bean.id ? "border-copper" : ""}`}
            onClick={() => setActiveBean(bean.id)}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">{bean.roaster}</div>
                <div className="text-xs text-muted">{bean.name}{bean.origin ? ` · ${bean.origin}` : ""}</div>
              </div>
              {activeBeanId === bean.id ? (
                <span className="text-[11px] text-copper font-medium">Aktiv</span>
              ) : null}
            </div>
            {fresh !== null ? (
              <div className="h-[5px] rounded-full bg-linen mt-2 overflow-hidden">
                <div className="h-full rounded-full bg-sage" style={{ width: `${fresh}%` }} />
              </div>
            ) : null}
            <button
              type="button"
              className="text-[11px] text-muted mt-2 underline"
              onClick={(e) => {
                e.stopPropagation();
                archiveBean(bean.id);
              }}
            >
              Archivieren
            </button>
          </Card>
        );
      })}
    </div>
  );
}
