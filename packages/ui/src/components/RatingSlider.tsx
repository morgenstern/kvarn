interface RatingSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  bipolarLabels?: [string, string];
}

export function RatingSlider({ label, value, min, max, onChange, bipolarLabels }: RatingSliderProps) {
  return (
    <div className="mt-[18px]">
      <div className="flex items-center justify-between mb-2 text-[13.5px]">
        <span>{label}</span>
        <span className="font-display num">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-copper h-8"
      />
      {bipolarLabels ? (
        <div className="flex justify-between text-[11px] text-muted mt-0.5">
          <span>{bipolarLabels[0]}</span>
          <span>{bipolarLabels[1]}</span>
        </div>
      ) : null}
    </div>
  );
}
