interface LogoProps {
  size?: number;
  spinning?: boolean;
  className?: string;
}

/**
 * The "dial" mark (brand/logos/kvarn-mark-dial-minimal.svg) — a mill/grinder
 * dial, doubling as the brand's loading indicator: per the brandbook, at
 * small sizes the mark rotates to signal "dialing in".
 */
export function Logo({ size = 28, spinning = false, className = "" }: LogoProps) {
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={`${spinning ? "animate-spin" : ""} ${className}`}
      aria-hidden="true"
    >
      <circle cx="60" cy="60" r="44" fill="none" stroke="#3B2E28" strokeWidth="6" />
      <line x1="60" y1="10" x2="60" y2="25" stroke="#C0754D" strokeWidth="6" strokeLinecap="round" />
      <circle cx="60" cy="60" r="6.5" fill="#3B2E28" />
    </svg>
  );
}

/** Icon + wordmark, for web headers (brandbook: "horizontal für Web-Header"). */
export function LogoLockup({ size = 22, className = "" }: { size?: number; className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Logo size={size} />
      <span className="font-display text-[17px] tracking-[0.18em] text-espresso">KVARN</span>
    </div>
  );
}
