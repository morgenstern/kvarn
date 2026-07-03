interface ParamStepperProps {
  label: string;
  unit?: string;
  value: number;
  step: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
}

export function ParamStepper({
  label,
  unit,
  value,
  step,
  min = -Infinity,
  max = Infinity,
  onChange,
  formatValue,
}: ParamStepperProps) {
  const clampRound = (raw: number) => {
    const rounded = Math.round(raw / step) * step;
    return Math.min(max, Math.max(min, rounded));
  };

  return (
    <div className="flex items-center justify-between py-[13px] border-b border-linen last:border-b-0">
      <div>
        <div className="text-sm">{label}</div>
        {unit ? <div className="text-[11px] text-muted">{unit}</div> : null}
      </div>
      <div className="flex items-center gap-3.5">
        <button
          type="button"
          aria-label={`${label} verringern`}
          onClick={() => onChange(clampRound(value - step))}
          className="w-8 h-8 rounded-control border border-linen bg-card text-[17px] text-espresso cursor-pointer"
        >
          −
        </button>
        <div className="font-display text-xl min-w-[52px] text-center num">
          {formatValue ? formatValue(value) : value}
        </div>
        <button
          type="button"
          aria-label={`${label} erhöhen`}
          onClick={() => onChange(clampRound(value + step))}
          className="w-8 h-8 rounded-control border border-linen bg-card text-[17px] text-espresso cursor-pointer"
        >
          +
        </button>
      </div>
    </div>
  );
}
