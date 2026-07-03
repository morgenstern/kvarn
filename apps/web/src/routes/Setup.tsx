import { useMemo, useState } from "react";
import { Button, Card, EntityImage, ProductCard, SectionLabel } from "@kvarn/ui";
import { submitProduct } from "@kvarn/api-client";
import type { Product, Setup as SetupType } from "@kvarn/db";
import type { LucideIcon } from "lucide-react";
import { Plus, Search, SlidersHorizontal, Users } from "lucide-react";
import { equipmentKind, useKvarnStore } from "../state/store";
import { SetupThumbnail } from "../components/SetupThumbnail";
import { useT } from "../i18n";

const METHODS: SetupType["method"][] = ["espresso", "v60", "aeropress", "frenchpress", "moka", "auto"];

type SubmissionState = "idle" | "submitting" | "submitted" | "error";

function EquipmentSearchSection({
  kind,
  icon,
  title,
  placeholder,
}: {
  kind: "grinder" | "machine";
  icon: LucideIcon;
  title: string;
  placeholder: string;
}) {
  const { products, addEquipmentFromProduct, addCustomEquipment } = useKvarnStore();
  const t = useT("setup");
  const [query, setQuery] = useState("");
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [submitBrand, setSubmitBrand] = useState("");
  const [submitModel, setSubmitModel] = useState("");
  const [submissionState, setSubmissionState] = useState<SubmissionState>("idle");

  const filteredProducts = useMemo(() => {
    if (!query) return [];
    const q = query.toLowerCase();
    return products.filter((p) => p.kind === kind && `${p.brand} ${p.model}`.toLowerCase().includes(q)).slice(0, 8);
  }, [products, query, kind]);

  return (
    <Card>
      <SectionLabel icon={icon}>{title}</SectionLabel>
      <input
        className="border border-linen rounded-control px-3 py-2 text-base bg-birch w-full"
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {filteredProducts.map((p) => (
        <button
          key={p.id}
          type="button"
          className="w-full text-left text-base py-2.5 border-b border-linen last:border-b-0 flex items-center gap-3"
          onClick={async () => {
            await addEquipmentFromProduct(p.id);
            setQuery("");
          }}
        >
          <EntityImage src={p.imageUrl} kind={kind} className="w-14 h-14 rounded-control flex-none" />
          {p.brand} {p.model}
        </button>
      ))}
      {query && filteredProducts.length === 0 ? (
        <div className="mt-2 flex flex-col gap-2 items-start">
          <button
            type="button"
            className="text-[15px] text-copper underline"
            onClick={async () => {
              await addCustomEquipment(query, kind);
              setQuery("");
            }}
          >
            {t("addAsCustom", { query })}
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 text-[15px] text-copper underline"
            onClick={() => {
              setSubmitBrand(query.split(" ")[0] ?? query);
              setSubmitModel(query.split(" ").slice(1).join(" "));
              setShowSubmitForm(true);
              setSubmissionState("idle");
            }}
          >
            <Users size={15} strokeWidth={1.5} />
            {t("suggestForCommunity")}
          </button>
        </div>
      ) : null}

      {showSubmitForm ? (
        <div className="mt-3 pt-3 border-t border-linen flex flex-col gap-2">
          <p className="text-sm text-muted">{t("submitIntro")}</p>
          <input
            className="border border-linen rounded-control px-3 py-2 text-base bg-birch"
            placeholder={t("brandPlaceholder")}
            value={submitBrand}
            onChange={(e) => setSubmitBrand(e.target.value)}
          />
          <input
            className="border border-linen rounded-control px-3 py-2 text-base bg-birch"
            placeholder={t("modelPlaceholder")}
            value={submitModel}
            onChange={(e) => setSubmitModel(e.target.value)}
          />
          <Button
            disabled={!submitBrand || !submitModel || submissionState === "submitting"}
            onClick={async () => {
              setSubmissionState("submitting");
              try {
                await submitProduct({ kind, brand: submitBrand, model: submitModel });
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
          {submissionState === "submitted" ? <p className="text-sm text-sage">{t("submitted")}</p> : null}
          {submissionState === "error" ? <p className="text-sm text-clay">{t("submitError")}</p> : null}
        </div>
      ) : null}
    </Card>
  );
}

export function Setup() {
  const state = useKvarnStore();
  const { products, equipment, setups, beans, addSetup, activeSetupId, setActiveSetup } = state;
  const t = useT("setup");
  const tCommon = useT("common");
  const [showSetupForm, setShowSetupForm] = useState(false);
  const [setupName, setSetupName] = useState("");
  const [method, setMethod] = useState<SetupType["method"]>("espresso");
  const [grinderEquipmentId, setGrinderEquipmentId] = useState<string>("");
  const [machineEquipmentId, setMachineEquipmentId] = useState<string>("");
  const [beanId, setBeanId] = useState<string>("");

  const grinderEquipment = equipment.filter((eq) => equipmentKind(state, eq.id) === "grinder");
  const machineEquipment = equipment.filter((eq) => equipmentKind(state, eq.id) === "machine");

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
    await addSetup({
      name: setupName,
      method,
      grinderEquipmentId,
      machineEquipmentId: machineEquipmentId || null,
      beanId: beanId || null,
    });
    setSetupName("");
    setGrinderEquipmentId("");
    setMachineEquipmentId("");
    setBeanId("");
    setShowSetupForm(false);
  }

  return (
    <div>
      <h1 className="font-display text-[32px] mt-3.5 mb-0.5">{t("title")}</h1>
      <p className="text-base text-muted">{t("subtitle")}</p>

      <EquipmentSearchSection kind="grinder" icon={Search} title={t("addGrinder")} placeholder={t("searchPlaceholder")} />
      <EquipmentSearchSection kind="machine" icon={Search} title={t("addMachine")} placeholder={t("searchPlaceholderMachine")} />

      {equipment.length > 0 ? (
        <>
          <SectionLabel className="mt-6">{t("yourEquipment")}</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            {equipment.map((eq) => {
              const product = products.find((p: Product) => p.id === eq.productId);
              return (
                <ProductCard
                  key={eq.id}
                  image={<EntityImage src={product?.imageUrl} kind={equipmentKind(state, eq.id)} className="w-full h-full" />}
                >
                  <div className="text-[15px] font-medium leading-tight">{equipmentLabel(eq.id)}</div>
                </ProductCard>
              );
            })}
          </div>
        </>
      ) : null}

      <div className="mt-6 flex items-center justify-between">
        <SectionLabel icon={SlidersHorizontal} className="mb-0">
          {t("setups")}
        </SectionLabel>
        <button
          type="button"
          className="flex items-center gap-1 text-[15px] text-copper underline"
          onClick={() => setShowSetupForm((v) => !v)}
        >
          {showSetupForm ? null : <Plus size={15} strokeWidth={1.5} />}
          {showSetupForm ? tCommon("cancel") : t("newSetup")}
        </button>
      </div>

      {showSetupForm ? (
        <Card>
          <form onSubmit={submitSetup} className="flex flex-col gap-3">
            <input
              className="border border-linen rounded-control px-3 py-2 text-base bg-birch"
              placeholder={t("setupNamePlaceholder")}
              value={setupName}
              onChange={(e) => setSetupName(e.target.value)}
              required
            />
            <select
              className="border border-linen rounded-control px-3 py-2 text-base bg-birch"
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
              className="border border-linen rounded-control px-3 py-2 text-base bg-birch"
              value={grinderEquipmentId}
              onChange={(e) => setGrinderEquipmentId(e.target.value)}
              required
            >
              <option value="" disabled>
                {t("chooseGrinder")}
              </option>
              {grinderEquipment.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {equipmentLabel(eq.id)}
                </option>
              ))}
            </select>
            <select
              className="border border-linen rounded-control px-3 py-2 text-base bg-birch"
              value={machineEquipmentId}
              onChange={(e) => setMachineEquipmentId(e.target.value)}
            >
              <option value="">{t("noMachine")}</option>
              {machineEquipment.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {equipmentLabel(eq.id)}
                </option>
              ))}
            </select>
            <select
              className="border border-linen rounded-control px-3 py-2 text-base bg-birch"
              value={beanId}
              onChange={(e) => setBeanId(e.target.value)}
            >
              <option value="">{t("noBean")}</option>
              {beans.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.roaster} — {b.name}
                </option>
              ))}
            </select>
            <Button type="submit" disabled={grinderEquipment.length === 0}>
              {t("saveSetup")}
            </Button>
          </form>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-3 mt-3">
        {setups.map((s) => (
          <ProductCard
            key={s.id}
            active={activeSetupId === s.id}
            onClick={() => setActiveSetup(s.id)}
            image={<SetupThumbnail setup={s} />}
          >
            <div className="text-[15px] font-medium leading-tight">{s.name}</div>
            <div className="text-[13px] text-muted mt-0.5">
              {s.method} · {equipmentLabel(s.grinderEquipmentId)}
              {s.machineEquipmentId ? ` + ${equipmentLabel(s.machineEquipmentId)}` : ""}
            </div>
          </ProductCard>
        ))}
      </div>
    </div>
  );
}
