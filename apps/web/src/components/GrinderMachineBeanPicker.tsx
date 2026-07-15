import { useMemo } from "react";
import { EntityImage, ProductCard, SectionLabel } from "@kvarn/ui";
import { Coffee, Package, SlidersHorizontal, X } from "lucide-react";
import { equipmentProduct, sortedBeans, sortedGrinders, sortedMachines, useKvarnStore } from "../state/store";
import { useT } from "../i18n";

/**
 * Shared grinder → machine → bean picker for starting a brew session (live
 * timer or manual historical entry) — replaces the old saved-"Setup" picker
 * and the inline "combo" assembly UI. Each list is pre-sorted most-recently-
 * used first (see sortedGrinders/sortedMachines/sortedBeans in
 * state/store.ts). Controlled component — the caller owns which ids are
 * selected (either the store's global active picks, for the live-brew flow,
 * or its own local state, for manual historical entry).
 */
export function GrinderMachineBeanPicker({
  grinderEquipmentId,
  machineEquipmentId,
  beanId,
  onGrinderChange,
  onMachineChange,
  onBeanChange,
}: {
  grinderEquipmentId: string;
  machineEquipmentId: string | null;
  beanId: string;
  onGrinderChange: (id: string) => void;
  onMachineChange: (id: string | null) => void;
  onBeanChange: (id: string) => void;
}) {
  const state = useKvarnStore();
  const t = useT("bruehen");
  // sortedGrinders/sortedMachines/sortedBeans are O(items × brews) — cheap at
  // this app's scale, but state comes from an unfiltered useKvarnStore()
  // subscription, so this component re-renders on any store change anywhere
  // (e.g. typing in an unrelated field on the same screen). Memoize on the
  // specific slices that actually affect sort order — `state` itself isn't a
  // dep on purpose, since it gets a new reference on every store mutation
  // (no selector), which would defeat the memoization entirely.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const grinders = useMemo(() => sortedGrinders(state), [state.equipment, state.brews]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const machines = useMemo(() => sortedMachines(state), [state.equipment, state.brews]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const beans = useMemo(() => sortedBeans(state), [state.beans, state.brews]);

  return (
    <>
      <SectionLabel icon={SlidersHorizontal} className="mt-5">{t("pickGrinder")}</SectionLabel>
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-5 px-5">
        {grinders.map((eq) => {
          const product = equipmentProduct(state, eq.id);
          return (
            <ProductCard
              key={eq.id}
              className="w-28 flex-none"
              active={grinderEquipmentId === eq.id}
              onClick={() => onGrinderChange(eq.id)}
              image={<EntityImage src={product?.imageUrl} kind="grinder" className="w-full h-full" />}
            >
              <div className="text-[13px] font-medium leading-tight truncate">
                {eq.customName ?? product?.model ?? "—"}
              </div>
            </ProductCard>
          );
        })}
      </div>

      <SectionLabel icon={Coffee} className="mt-5">{t("pickMachine")}</SectionLabel>
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-5 px-5">
        <ProductCard
          className="w-28 flex-none"
          active={machineEquipmentId === null}
          onClick={() => onMachineChange(null)}
          image={
            <div className="w-full h-full flex items-center justify-center text-muted">
              <X size={28} strokeWidth={1.5} />
            </div>
          }
        >
          <div className="text-[13px] font-medium leading-tight truncate">{t("noMachine")}</div>
        </ProductCard>
        {machines.map((eq) => {
          const product = equipmentProduct(state, eq.id);
          return (
            <ProductCard
              key={eq.id}
              className="w-28 flex-none"
              active={machineEquipmentId === eq.id}
              onClick={() => onMachineChange(eq.id)}
              image={<EntityImage src={product?.imageUrl} kind="machine" className="w-full h-full" />}
            >
              <div className="text-[13px] font-medium leading-tight truncate">
                {eq.customName ?? product?.model ?? "—"}
              </div>
            </ProductCard>
          );
        })}
      </div>

      <SectionLabel icon={Package} className="mt-5">{t("pickBean")}</SectionLabel>
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-5 px-5">
        {beans.map((b) => (
          <ProductCard
            key={b.id}
            className="w-28 flex-none"
            active={beanId === b.id}
            onClick={() => onBeanChange(b.id)}
            image={<EntityImage src={b.imageUrl ?? b.photoUrl} kind="bean" className="w-full h-full" />}
          >
            <div className="text-[13px] font-medium leading-tight truncate">{b.roaster}</div>
          </ProductCard>
        ))}
      </div>
    </>
  );
}
