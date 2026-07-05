import { useState } from "react";
import { Button, Card, EntityImage, ProductCard, SectionLabel, Select } from "@kvarn/ui";
import type { Setup as SetupType } from "@kvarn/db";
import type { LucideIcon } from "lucide-react";
import { Coffee, Plus, SlidersHorizontal } from "lucide-react";
import { equipmentImage, equipmentKind, useKvarnStore } from "../state/store";
import { SetupThumbnail } from "../components/SetupThumbnail";
import { EquipmentSearchSection } from "../components/EquipmentSearchSection";
import { useT } from "../i18n";

const METHODS: SetupType["method"][] = ["espresso", "v60", "aeropress", "frenchpress", "moka", "auto"];

/** Collapses the (fairly tall) equipment search behind a single tap target,
 * sliding it open via a CSS grid-rows trick rather than measuring heights. */
function CollapsibleEquipmentSection({
  kind,
  icon: Icon,
  label,
  placeholder,
}: {
  kind: "grinder" | "machine";
  icon: LucideIcon;
  label: string;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3.5">
      <button
        type="button"
        className="w-full flex items-center justify-between gap-3 bg-card border border-linen rounded-card px-4 py-3.5"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-2.5 text-base font-medium text-espresso">
          <Icon size={18} strokeWidth={1.5} />
          {label}
        </span>
        <Plus size={18} strokeWidth={1.5} className={`transition-transform ${open ? "rotate-45" : ""}`} />
      </button>
      <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <EquipmentSearchSection kind={kind} icon={Icon} title={label} placeholder={placeholder} />
        </div>
      </div>
    </div>
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

      <CollapsibleEquipmentSection kind="grinder" icon={SlidersHorizontal} label={t("addGrinder")} placeholder={t("searchPlaceholder")} />
      <CollapsibleEquipmentSection kind="machine" icon={Coffee} label={t("addMachine")} placeholder={t("searchPlaceholderMachine")} />

      {equipment.length > 0 ? (
        <>
          <SectionLabel className="mt-5">{t("yourEquipment")}</SectionLabel>
          <div className="grid grid-cols-2 gap-3 mt-3">
            {equipment.map((eq) => (
              <ProductCard
                key={eq.id}
                image={<EntityImage src={equipmentImage(state, eq.id)} kind={equipmentKind(state, eq.id)} className="w-full h-full" />}
              >
                <div className="text-[15px] font-medium leading-tight">{equipmentLabel(eq.id)}</div>
              </ProductCard>
            ))}
          </div>
        </>
      ) : null}

      <SectionLabel
        icon={SlidersHorizontal}
        className="mt-5"
        action={
          <button
            type="button"
            className="flex items-center gap-1 text-[15px] text-copper underline py-2.5 px-1 -my-2.5 -mr-1"
            onClick={() => setShowSetupForm((v) => !v)}
          >
            {showSetupForm ? null : <Plus size={15} strokeWidth={1.5} />}
            {showSetupForm ? tCommon("cancel") : t("newSetup")}
          </button>
        }
      >
        {t("setups")}
      </SectionLabel>

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
            <Select
              value={method}
              onChange={(v) => setMethod(v as SetupType["method"])}
              options={METHODS.map((m) => ({ value: m, label: m }))}
            />
            <Select
              value={grinderEquipmentId}
              onChange={setGrinderEquipmentId}
              placeholder={t("chooseGrinder")}
              options={grinderEquipment.map((eq) => ({ value: eq.id, label: equipmentLabel(eq.id) }))}
            />
            <Select
              value={machineEquipmentId}
              onChange={setMachineEquipmentId}
              placeholder={t("noMachine")}
              options={machineEquipment.map((eq) => ({ value: eq.id, label: equipmentLabel(eq.id) }))}
            />
            <Select
              value={beanId}
              onChange={setBeanId}
              placeholder={t("noBean")}
              options={beans.map((b) => ({ value: b.id, label: `${b.roaster} — ${b.name}` }))}
            />
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
