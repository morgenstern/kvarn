import { useState } from "react";
import { Button, EntityImage, Modal, ProductCard, SectionLabel } from "@kvarn/ui";
import type { LucideIcon } from "lucide-react";
import { Coffee, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { equipmentGrindScale, equipmentImage, equipmentKind, useKvarnStore, type GrindScaleValue } from "../state/store";
import { EquipmentSearchSection } from "../components/EquipmentSearchSection";
import { GrindScaleFields } from "../components/GrindScaleFields";
import { useT } from "../i18n";

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
  const { products, equipment, setEquipmentGrindScale, setEquipmentCustomName, deleteEquipment } = state;
  const t = useT("setup");
  const tCommon = useT("common");
  const [editingEquipmentId, setEditingEquipmentId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editScale, setEditScale] = useState<GrindScaleValue | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  function equipmentLabel(equipmentId: string): string {
    const eq = equipment.find((e) => e.id === equipmentId);
    if (!eq) return "—";
    if (eq.customName) return eq.customName;
    const product = products.find((p) => p.id === eq.productId);
    return product ? `${product.brand} ${product.model}` : "—";
  }

  function originalProductLabel(equipmentId: string): string | null {
    const eq = equipment.find((e) => e.id === equipmentId);
    if (!eq?.productId) return null;
    const product = products.find((p) => p.id === eq.productId);
    return product ? `${product.brand} ${product.model}` : null;
  }

  function openEquipmentEditor(equipmentId: string) {
    const eq = equipment.find((e) => e.id === equipmentId);
    setEditingEquipmentId(equipmentId);
    setEditName(eq?.customName ?? "");
    setEditScale(equipmentKind(state, equipmentId) === "grinder" ? equipmentGrindScale(state, equipmentId) : null);
    setDeleteConfirm(false);
  }

  function closeEquipmentEditor() {
    setEditingEquipmentId(null);
    setDeleteConfirm(false);
  }

  async function saveEquipmentEdits() {
    if (!editingEquipmentId) return;
    await setEquipmentCustomName(editingEquipmentId, editName.trim() || null);
    if (editScale) {
      await setEquipmentGrindScale(editingEquipmentId, editScale);
    }
    closeEquipmentEditor();
  }

  async function handleDeleteEquipment() {
    if (!editingEquipmentId) return;
    await deleteEquipment(editingEquipmentId);
    closeEquipmentEditor();
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
                onClick={() => openEquipmentEditor(eq.id)}
                image={<EntityImage src={equipmentImage(state, eq.id)} kind={equipmentKind(state, eq.id)} className="w-full h-full" />}
              >
                <div className="text-[15px] font-medium leading-tight">{equipmentLabel(eq.id)}</div>
                <div className="text-[12px] text-muted mt-0.5">{t("tapToEdit")}</div>
              </ProductCard>
            ))}
          </div>
        </>
      ) : null}

      {editingEquipmentId
        ? (() => {
            const originalName = originalProductLabel(editingEquipmentId);
            return (
              <Modal onClose={closeEquipmentEditor}>
                <SectionLabel icon={equipmentKind(state, editingEquipmentId) === "grinder" ? SlidersHorizontal : Coffee}>
                  {t("editEquipmentTitle", { name: equipmentLabel(editingEquipmentId) })}
                </SectionLabel>
                {originalName ? <p className="text-sm text-muted mb-2">{t("originalNameLabel", { name: originalName })}</p> : null}
                <input
                  className="border border-linen rounded-control px-3 py-2 text-base bg-birch w-full mb-3"
                  placeholder={t("customNamePlaceholder")}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
                {editScale ? <GrindScaleFields value={editScale} onChange={setEditScale} /> : null}
                <Button onClick={saveEquipmentEdits}>{t("saveChanges")}</Button>
                {!deleteConfirm ? (
                  <Button variant="ghost" onClick={() => setDeleteConfirm(true)}>
                    <Trash2 size={18} strokeWidth={1.5} />
                    {t("deleteEquipment")}
                  </Button>
                ) : (
                  <>
                    <p className="text-base text-clay mt-3">{t("deleteEquipmentConfirm")}</p>
                    <Button onClick={handleDeleteEquipment}>{t("deleteEquipmentConfirmButton")}</Button>
                    <Button variant="ghost" onClick={() => setDeleteConfirm(false)}>
                      {tCommon("cancel")}
                    </Button>
                  </>
                )}
              </Modal>
            );
          })()
        : null}
    </div>
  );
}
