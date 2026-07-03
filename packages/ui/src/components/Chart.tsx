interface ChartPoint {
  x: number;
  y: number;
  label?: string;
}

/**
 * Only falls back to a synthetic [0,1] domain when there's no real data —
 * blending 0/1 into Math.min/max of actual values (e.g. millisecond
 * timestamps) would silently corrupt the axis instead of being a no-op.
 */
export function computeDomain(values: number[], explicit?: [number, number]): [number, number] {
  if (explicit) return explicit;
  if (values.length === 0) return [0, 1];
  return [Math.min(...values), Math.max(...values)];
}

interface ChartProps {
  points: ChartPoint[];
  mode?: "line" | "scatter";
  xDomain?: [number, number];
  yDomain?: [number, number];
  width?: number;
  height?: number;
  /** y-range shaded sage — "target corridor" per docs/01_BRAND_DESIGN.md §6. */
  targetBand?: [number, number];
  xAxisLabel?: (x: number) => string;
  yAxisLabel?: (y: number) => string;
}

/**
 * Minimal chart per the brand's data-viz rules: thin lines, dots instead of
 * bars, copper for "your value", sage for the target corridor. No chart
 * library — this covers freshness curves, rating history, and scatter
 * insights (humidity×time, bean-age×rating) with one component.
 */
export function Chart({
  points,
  mode = "scatter",
  xDomain,
  yDomain,
  width = 320,
  height = 140,
  targetBand,
  xAxisLabel,
  yAxisLabel,
}: ChartProps) {
  const padding = { top: 10, right: 12, bottom: 20, left: 12 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const [xMin, xMax] = computeDomain(points.map((p) => p.x), xDomain);
  const [yMin, yMax] = computeDomain(points.map((p) => p.y), yDomain);

  const scaleX = (x: number) => padding.left + ((x - xMin) / (xMax - xMin || 1)) * plotW;
  const scaleY = (y: number) => padding.top + plotH - ((y - yMin) / (yMax - yMin || 1)) * plotH;

  const sorted = [...points].sort((a, b) => a.x - b.x);
  const linePath = sorted.map((p, i) => `${i === 0 ? "M" : "L"} ${scaleX(p.x)} ${scaleY(p.y)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height}>
      {targetBand ? (
        <rect
          x={padding.left}
          y={scaleY(targetBand[1])}
          width={plotW}
          height={scaleY(targetBand[0]) - scaleY(targetBand[1])}
          fill="var(--color-sage-soft)"
          rx={4}
        />
      ) : null}

      <line
        x1={padding.left}
        y1={padding.top + plotH}
        x2={padding.left + plotW}
        y2={padding.top + plotH}
        stroke="var(--color-linen)"
        strokeWidth={1}
      />

      {mode === "line" ? <path d={linePath} fill="none" stroke="var(--color-copper)" strokeWidth={1.5} /> : null}

      {points.map((p, i) => (
        <circle key={i} cx={scaleX(p.x)} cy={scaleY(p.y)} r={3} fill="var(--color-copper)" />
      ))}

      {xAxisLabel ? (
        <>
          <text x={padding.left} y={height - 4} fontSize={10} fill="var(--color-muted)">
            {xAxisLabel(xMin)}
          </text>
          <text x={padding.left + plotW} y={height - 4} fontSize={10} fill="var(--color-muted)" textAnchor="end">
            {xAxisLabel(xMax)}
          </text>
        </>
      ) : null}
      {yAxisLabel ? (
        <text x={padding.left} y={padding.top + 8} fontSize={10} fill="var(--color-muted)">
          {yAxisLabel(yMax)}
        </text>
      ) : null}
    </svg>
  );
}
