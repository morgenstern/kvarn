interface RatioVizProps {
  doseG: number;
  yieldG: number;
  doseLabel: string;
  yieldLabel: string;
  className?: string;
}

/**
 * Live dose:yield proportion bar — copper segment for dose, sage for yield,
 * width transitions smoothly as either ParamStepper changes so the ratio is
 * felt, not just read as a number.
 */
export function RatioViz({ doseG, yieldG, doseLabel, yieldLabel, className = "" }: RatioVizProps) {
  const total = doseG + yieldG;
  const dosePct = total > 0 ? (doseG / total) * 100 : 50;

  return (
    <div className={className}>
      <div className="flex h-3 rounded-full overflow-hidden bg-linen">
        <div className="bg-copper transition-[width] duration-300 ease-out" style={{ width: `${dosePct}%` }} />
        <div className="bg-sage transition-[width] duration-300 ease-out" style={{ width: `${100 - dosePct}%` }} />
      </div>
      <div className="flex justify-between text-[12px] text-muted mt-1.5">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-copper inline-block flex-none" />
          {doseLabel}
        </span>
        <span className="flex items-center gap-1.5">
          {yieldLabel}
          <span className="w-2 h-2 rounded-full bg-sage inline-block flex-none" />
        </span>
      </div>
    </div>
  );
}
