interface TimerRingProps {
  elapsedS: number;
  lapLabel?: string;
  size?: number;
  /** Ring fills up to this many seconds, then holds at full (0 = no target, ring stays empty-tracking). */
  targetS?: number;
}

export function TimerRing({ elapsedS, lapLabel, size = 250, targetS = 40 }: TimerRingProps) {
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = targetS > 0 ? Math.min(1, elapsedS / targetS) : 0;
  const offset = circumference * (1 - progress);

  const minutes = Math.floor(elapsedS / 60);
  const seconds = (elapsedS % 60).toFixed(1);
  const display = minutes > 0 ? `${minutes}:${seconds.padStart(4, "0")}` : seconds;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-linen)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-copper)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset .3s linear" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-display text-[52px] num tracking-tight">{display}</div>
        {lapLabel ? <div className="text-[12.5px] text-muted mt-1">{lapLabel}</div> : null}
      </div>
    </div>
  );
}
