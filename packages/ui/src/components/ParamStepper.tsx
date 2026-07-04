import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { GripHorizontal } from "lucide-react";

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

// Drag-to-scrub tuning: most params here have no upper bound (dose/yield),
// so this scrubs relative to the drag start rather than mapping to a fixed
// track like a normal <input type="range">.
const PX_PER_STEP = 12;
const DRAG_THRESHOLD_PX = 4;

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
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const drag = useRef<{ startX: number; startValue: number; dragged: boolean } | null>(null);

  const clampRound = (raw: number) => {
    // Snap to the step grid, then strip binary floating-point noise
    // (e.g. 2.5 - 0.1 -> 2.4000000000000004).
    const snapped = Math.round((Math.round(raw / step) * step) * 1e8) / 1e8;
    return Math.min(max, Math.max(min, snapped));
  };

  function commitEdit() {
    const parsed = Number(editValue.replace(",", "."));
    if (Number.isFinite(parsed)) onChange(clampRound(parsed));
    setIsEditing(false);
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic/test-dispatched pointer events may not have an active
      // pointer session to capture — dragging still works without capture,
      // it just won't keep tracking if the pointer leaves the element.
    }
    drag.current = { startX: e.clientX, startValue: value, dragged: false };
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const deltaX = e.clientX - drag.current.startX;
    if (Math.abs(deltaX) > DRAG_THRESHOLD_PX) drag.current.dragged = true;
    if (!drag.current.dragged) return;
    onChange(clampRound(drag.current.startValue + Math.round(deltaX / PX_PER_STEP) * step));
  }

  function handlePointerUp() {
    const wasDragged = drag.current?.dragged ?? false;
    drag.current = null;
    if (!wasDragged) {
      setEditValue(String(value));
      setIsEditing(true);
    }
  }

  return (
    <div className="flex items-center justify-between py-[13px] border-b border-linen last:border-b-0">
      <div>
        <div className="text-base">{label}</div>
        {unit ? <div className="text-[13px] text-muted">{unit}</div> : null}
      </div>
      <div className="flex items-center gap-3.5">
        <button
          type="button"
          aria-label={`${label} verringern`}
          onClick={() => onChange(clampRound(value - step))}
          className="w-8 h-8 rounded-control border border-linen bg-card text-[19px] text-espresso cursor-pointer"
        >
          −
        </button>
        {isEditing ? (
          <input
            type="text"
            inputMode="decimal"
            autoFocus
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitEdit();
              if (e.key === "Escape") setIsEditing(false);
            }}
            className="font-display text-2xl min-w-[52px] w-16 text-center num bg-birch border-b border-copper outline-none"
          />
        ) : (
          <div
            role="button"
            aria-label={`${label}, ${formatValue ? formatValue(value) : value}. Ziehen zum Anpassen, tippen zum Eingeben.`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="font-display text-2xl min-w-[52px] text-center num cursor-ew-resize select-none touch-none flex flex-col items-center"
          >
            {formatValue ? formatValue(value) : value}
            <GripHorizontal size={10} strokeWidth={1.5} className="text-muted -mt-0.5" />
          </div>
        )}
        <button
          type="button"
          aria-label={`${label} erhöhen`}
          onClick={() => onChange(clampRound(value + step))}
          className="w-8 h-8 rounded-control border border-linen bg-card text-[19px] text-espresso cursor-pointer"
        >
          +
        </button>
      </div>
    </div>
  );
}
