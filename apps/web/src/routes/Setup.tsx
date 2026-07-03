import { useMemo, useState } from "react";
import { Button, Card, Chip } from "@kvarn/ui";
import { submitProduct } from "@kvarn/api-client";
import type { Setup as SetupType } from "@kvarn/db";
import { useKvarnStore } from "../state/store";
import { useT } from "../i18n";

const METHODS: SetupType["method"][] = ["espresso", "v60", "aeropress", "frenchpress", "moka", "auto"];

type SubmissionState = "idle" | "submitting" | "submitted" | "error";

export function Setup() {
  const { products, equipment, setups, addEquipmentFromProduct, addCustomEquipment, addSetup, activeSetupId, setActiveSetup } =
    useKvarnStore();
  const t = useT("setup");
  const tCommon = useT("common");
  const [query, setQuery] = useState("");
  const [showSetupForm, setShowSetupForm] = useState(false);
  const [setupName, setSetupName] = useState("");
  const [method, setMethod] = useState<SetupType["method"]>("espresso");
  const [grinderEquipmentId, setGrinderEquipmentId] = useState<string>("");
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [submitBrand, setSubmitBrand] = useState("");
  const [submitModel, setSubmitModel] = useState("");
  const [submissionState, setSubmissionState] = useState<SubmissionState>("idle");

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
      <h1 className="font-display text-[28px] mt-3.5 mb-0.5">{t("title")}</h1>
      <p className="text-sm text-muted">{t("subtitle")}</p>

      <Card>
        <div className="text-[11px] uppercase tracking-wider text-muted font-medium mb-2">{t("addGrinder")}</div>
        <input
          className="border border-linen rounded-control px-3 py-2 text-sm bg-birch w-full"
          placeholder={t("searchPlaceholder")}
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
          <div className="mt-2 flex flex-col gap-2 items-start">
            <button
              type="button"
              className="text-[13px] text-copper underline"
              onClick={async () => {
                await addCustomEquipment(query);
                setQuery("");
              }}
            >
              {t("addAsCustom", { query })}
            </button>
            <button
              type="button"
              className="text-[13px] text-copper underline"
              onClick={() => {
                setSubmitBrand(query.split(" ")[0] ?? query);
                setSubmitModel(query.split(" ").slice(1).join(" "));
                setShowSubmitForm(true);
                setSubmissionState("idle");
              }}
            >
              {t("suggestForCommunity")}
            </button>
          </div>
        ) : null}

        {showSubmitForm ? (
          <div className="mt-3 pt-3 border-t border-linen flex flex-col gap-2">
            <p className="text-xs text-muted">{t("submitIntro")}</p>
            <input
              className="border border-linen rounded-control px-3 py-2 text-sm bg-birch"
              placeholder={t("brandPlaceholder")}
              value={submitBrand}
              onChange={(e) => setSubmitBrand(e.target.value)}
            />
            <input
              className="border border-linen rounded-control px-3 py-2 text-sm bg-birch"
              placeholder={t("modelPlaceholder")}
              value={submitModel}
              onChange={(e) => setSubmitModel(e.target.value)}
            />
            <Button
              disabled={!submitBrand || !submitModel || submissionState === "submitting"}
              onClick={async () => {
                setSubmissionState("submitting");
                try {
                  await submitProduct({ kind: "grinder", brand: submitBrand, model: submitModel });
                  setSubmissionState("submitted");
                  setSubmitBrand("");
                  setSubmitModel("");
                } catch {
                  setSubmissionState("error");
                }
              }}
            >
              {t("submit")}
            </Button>
            {submissionState === "submitted" ? <p className="text-xs text-sage">{t("submitted")}</p> : null}
            {submissionState === "error" ? <p className="text-xs text-clay">{t("submitError")}</p> : null}
          </div>
        ) : null}
      </Card>

      {equipment.length > 0 ? (
        <Card>
          <div className="text-[11px] uppercase tracking-wider text-muted font-medium mb-2">{t("yourEquipment")}</div>
          <div className="flex flex-wrap gap-2">
            {equipment.map((eq) => (
              <Chip key={eq.id}>{equipmentLabel(eq.id)}</Chip>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="mt-6 flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-wider text-muted font-medium">{t("setups")}</div>
        <button type="button" className="text-[13px] text-copper underline" onClick={() => setShowSetupForm((v) => !v)}>
          {showSetupForm ? tCommon("cancel") : t("newSetup")}
        </button>
      </div>

      {showSetupForm ? (
        <Card>
          <form onSubmit={submitSetup} className="flex flex-col gap-3">
            <input
              className="border border-linen rounded-control px-3 py-2 text-sm bg-birch"
              placeholder={t("setupNamePlaceholder")}
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
                {t("chooseGrinder")}
              </option>
              {equipment.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {equipmentLabel(eq.id)}
                </option>
              ))}
            </select>
            <Button type="submit" disabled={equipment.length === 0}>
              {t("saveSetup")}
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
            {activeSetupId === s.id ? <span className="text-[11px] text-copper font-medium">{tCommon("active")}</span> : null}
          </div>
        </Card>
      ))}
    </div>
  );
}
