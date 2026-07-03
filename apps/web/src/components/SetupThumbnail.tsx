import { EntityImage } from "@kvarn/ui";
import type { Setup } from "@kvarn/db";
import { equipmentKind, equipmentProduct, useKvarnStore } from "../state/store";

/**
 * A setup's card image: just the grinder (mill) if that's all it has, or a
 * split mill|machine view when a machine is attached — so a setup card
 * visually shows both halves of "mill + machine" at a glance.
 */
export function SetupThumbnail({ setup, className = "" }: { setup: Setup; className?: string }) {
  const state = useKvarnStore();
  const grinderImage = equipmentProduct(state, setup.grinderEquipmentId)?.imageUrl ?? null;
  const grinderKind = equipmentKind(state, setup.grinderEquipmentId);

  if (!setup.machineEquipmentId) {
    return <EntityImage src={grinderImage} kind={grinderKind} className={`w-full h-full ${className}`} />;
  }

  const machineImage = equipmentProduct(state, setup.machineEquipmentId)?.imageUrl ?? null;
  const machineKind = equipmentKind(state, setup.machineEquipmentId);

  return (
    <div className={`flex w-full h-full ${className}`}>
      <EntityImage src={grinderImage} kind={grinderKind} className="w-1/2 h-full border-r border-birch" />
      <EntityImage src={machineImage} kind={machineKind} className="w-1/2 h-full" />
    </div>
  );
}
