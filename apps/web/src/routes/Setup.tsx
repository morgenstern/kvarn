import { useMemo, useState } from "react";
import { Button, Card, Chip } from "@kvarn/ui";
import type { Setup as SetupType } from "@kvarn/db";
import { useKvarnStore } from "../state/store";

const METHODS: SetupType["method"][] = ["espresso", "v60", "aeropress", "frenchpress", "moka", "auto"];

export function Setup() {
  const { products, equipment, setups, addEquipmentFromProduct, addCustomEquipment, addSetup, activeSetupId, setActiveSetup } =
    useKvarnStore();
  const [query, setQuery] = useState("");
  const [showSetupForm, setShowSetupForm] = useState(false);
  const [setupName, setSetupName] = useState("");
  const [method, setMethod] = useState<SetupType["method"]>("espresso");
  const [grinderEquipmentId, setGrinderEquipmentId] = useState<string>("");

  const filteredProducts = useMemo(() => {
    if (!query) return [];
    const q = query.toLowerCase();
    return products
      .filter((p) => p.kind === "grinder" && `${p.brand} ${p.model}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [products, query]);

  function equipmentLabel(equipmentId: string): string {
    const eq = equipment.find((e) => e.id === equipmentId);
    if (!eq) return "—";
    if (eq.customName) return eq.customName;
    const product = products.find((p) => p.id === eq.productId);
    return product ? `${product.brand} ${product.model}` : "—";
  }

  async function submitSetup(e: React.FormEvent) {
    e.preventDefault();
    if (!setupName || !grinderEquipmentId) return;
    await addSetup({ name: setupName, method, grinderEquipmentId });
    setSetupName("");
    setGrinderEquipmentId("");
    setShowSetupForm(false);
  }

  return (
    <div>
      <h1 className="font-display text-[28px] mt-3.5 mb-0.5">Setup</h1>
      <p className="text-sm text-muted">Equipment & Zubereitungsarten.</p>

      <Card>
        <div className="text-[11px] uppercase tracking-wider text-muted font-medium mb-2">Mühle hinzufügen</div>
        <input
          className="border border-linen rounded-control px-3 py-2 text-sm bg-birch w-full"
          placeholder="z. B. Niche, Comandante, DF64 …"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {filteredProducts.map((p) => (
          <button
            key={p.id}
            type="button"
            className="w-full text-left text-sm py-2 border-b border-linen last:border-b-0"
            onClick={async () => {
              await addEquipmentFromProduct(p.id);
              setQuery("");
            }}
          >
            {p.brand} {p.model}
          </button>
        ))}
        {query && filteredProducts.length === 0 ? (
          <button
            type="button"
            className="text-[13px] text-copper underline mt-2"
            onClick={async () => {
              await addCustomEquipment(query);
              setQuery("");
            }}
          >
            „{query}“ als eigenes Gerät anlegen
          </button>
        ) : null}
      </Card>

      {equipment.length > 0 ? (
        <Card>
          <div className="text-[11px] uppercase tracking-wider text-muted font-medium mb-2">Dein Equipment</div>
          <div className="flex flex-wrap gap-2">
            {equipment.map((eq) => (
              <Chip key={eq.id}>{equipmentLabel(eq.id)}</Chip>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="mt-6 flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-wider text-muted font-medium">Setups</div>
        <button type="button" className="text-[13px] text-copper underline" onClick={() => setShowSetupForm((v) => !v)}>
          {showSetupForm ? "Abbrechen" : "+ Neues Setup"}
        </button>
      </div>

      {showSetupForm ? (
        <Card>
          <form onSubmit={submitSetup} className="flex flex-col gap-3">
            <input
              className="border border-linen rounded-control px-3 py-2 text-sm bg-birch"
              placeholder="Setup-Name, z. B. „Zuhause Espresso“"
              value={setupName}
              onChange={(e) => setSetupName(e.target.value)}
              required
            />
            <select
              className="border border-linen rounded-control px-3 py-2 text-sm bg-birch"
              value={method}
              onChange={(e) => setMethod(e.target.value as SetupType["method"])}
            >
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <select
              className="border border-linen rounded-control px-3 py-2 text-sm bg-birch"
              value={grinderEquipmentId}
              onChange={(e) => setGrinderEquipmentId(e.target.value)}
              required
            >
              <option value="" disabled>
                Mühle wählen …
              </option>
              {equipment.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {equipmentLabel(eq.id)}
                </option>
              ))}
            </select>
            <Button type="submit" disabled={equipment.length === 0}>
              Setup speichern
            </Button>
          </form>
        </Card>
      ) : null}

      {setups.map((s) => (
        <Card
          key={s.id}
          className={`cursor-pointer ${activeSetupId === s.id ? "border-copper" : ""}`}
          onClick={() => setActiveSetup(s.id)}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">{s.name}</div>
              <div className="text-xs text-muted">{s.method} · {equipmentLabel(s.grinderEquipmentId)}</div>
            </div>
            {activeSetupId === s.id ? <span className="text-[11px] text-copper font-medium">Aktiv</span> : null}
          </div>
        </Card>
      ))}
    </div>
  );
}
