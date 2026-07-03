import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button, Card } from "@kvarn/ui";
import { uploadPhoto } from "@kvarn/api-client";
import { computeBeanAgeDays, freshnessPct } from "@kvarn/core";
import { useKvarnStore } from "../state/store";

function beanFreshnessPct(roastDate: string | null): number | null {
  if (!roastDate) return null;
  return freshnessPct(computeBeanAgeDays(new Date(roastDate), new Date()));
}

export function Regal() {
  const { beans, addBean, archiveBean, activeBeanId, setActiveBean } = useKvarnStore();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [roaster, setRoaster] = useState("");
  const [name, setName] = useState("");
  const [origin, setOrigin] = useState("");
  const [roastDate, setRoastDate] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | undefined>();
  const [photoUploading, setPhotoUploading] = useState(false);

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    try {
      setPhotoUrl(await uploadPhoto(file));
    } catch {
      // Photo is a nice-to-have, never blocks saving the bean.
      setPhotoUrl(undefined);
    } finally {
      setPhotoUploading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!roaster || !name) return;
    await addBean({ roaster, name, origin: origin || undefined, roastDate: roastDate || undefined, photoUrl });
    setRoaster("");
    setName("");
    setOrigin("");
    setRoastDate("");
    setPhotoUrl(undefined);
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
            <label className="text-xs text-muted -mb-2">Foto vom Etikett (optional)</label>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} className="text-sm" />
            {photoUploading ? <p className="text-xs text-muted">Lädt hoch …</p> : null}
            {photoUrl ? <img src={photoUrl} alt="" className="w-20 h-20 object-cover rounded-control" /> : null}
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
        const fresh = beanFreshnessPct(bean.roastDate);
        return (
          <Card
            key={bean.id}
            className={`cursor-pointer flex gap-3 ${activeBeanId === bean.id ? "border-copper" : ""}`}
            onClick={() => navigate({ to: "/regal/$beanId", params: { beanId: bean.id } })}
          >
            {bean.photoUrl ? (
              <img src={bean.photoUrl} alt="" className="w-14 h-14 object-cover rounded-control flex-none" />
            ) : null}
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{bean.roaster}</div>
                  <div className="text-xs text-muted">{bean.name}{bean.origin ? ` · ${bean.origin}` : ""}</div>
                </div>
                {activeBeanId === bean.id ? (
                  <span className="text-[11px] text-copper font-medium">Aktiv</span>
                ) : (
                  <button
                    type="button"
                    className="text-[11px] text-muted underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveBean(bean.id);
                    }}
                  >
                    Aktiv setzen
                  </button>
                )}
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
            </div>
          </Card>
        );
      })}
    </div>
  );
}
