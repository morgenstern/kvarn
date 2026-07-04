interface WeatherStripProps {
  tempC: number | null;
  humidityPct: number | null;
  pressureHpa: number | null;
  condition: string;
  humidityLabel: string;
  pressureLabel: string;
  className?: string;
}

/**
 * Dark "weather strip" — deliberately breaks from the app's light cards for
 * contrast, matching the early prototype's espresso-on-birch treatment.
 */
export function WeatherStrip({
  tempC,
  humidityPct,
  pressureHpa,
  condition,
  humidityLabel,
  pressureLabel,
  className = "",
}: WeatherStripProps) {
  return (
    <div className={`flex items-center gap-4 bg-espresso text-birch rounded-card px-4 py-3.5 ${className}`}>
      <div className="font-display text-[26px] num flex-none">{tempC != null ? `${Math.round(tempC)}°` : "—"}</div>
      <div className="text-[12px] leading-relaxed opacity-80">
        {humidityLabel}
        <br />
        <span className="text-sm font-medium opacity-100 num">{humidityPct != null ? `${Math.round(humidityPct)}%` : "—"}</span>
      </div>
      <div className="text-[12px] leading-relaxed opacity-80">
        {pressureLabel}
        <br />
        <span className="text-sm font-medium opacity-100 num">{pressureHpa != null ? `${Math.round(pressureHpa)} hPa` : "—"}</span>
      </div>
      <div className="ml-auto text-right text-sm font-medium flex-none">{condition}</div>
    </div>
  );
}
