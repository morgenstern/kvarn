interface PlaceholderProps {
  className?: string;
}

/**
 * Fallback category art for products/beans without a real illustration yet
 * (docs/07_ILLUSTRATION_STYLE.md §3 step 5: "generic category icon in the
 * same style, as a static design-system asset"). Simple single-stroke line
 * art in espresso brown on a soft birch badge — deliberately lighter-weight
 * than the full watercolor "Kvarn Sketch" illustrations, which are reserved
 * for real per-product renderings.
 */
// Size (w-/h-) is entirely controlled by the caller's className — the base
// classes here must not include their own w-/h- utilities, since Tailwind
// gives same-specificity classes no guaranteed DOM-order precedence and a
// hardcoded size here can silently outrank (or lose to) the caller's.
function Badge({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-full bg-linen flex items-center justify-center flex-none ${className}`}>
      <svg viewBox="0 0 64 64" className="w-[60%] h-[60%]" fill="none" stroke="#3B2E28" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </div>
  );
}

export function GrinderPlaceholder({ className }: PlaceholderProps) {
  return (
    <Badge className={className}>
      <path d="M22 14 L42 14 L38 26 L26 26 Z" />
      <rect x="24" y="26" width="16" height="28" rx="3" />
      <line x1="24" y1="36" x2="40" y2="36" />
      <circle cx="32" cy="46" r="3" />
    </Badge>
  );
}

export function MachinePlaceholder({ className }: PlaceholderProps) {
  return (
    <Badge className={className}>
      <rect x="14" y="16" width="36" height="30" rx="3" />
      <circle cx="24" cy="27" r="5" />
      <line x1="38" y1="24" x2="46" y2="24" />
      <line x1="38" y1="30" x2="46" y2="30" />
      <path d="M26 46 L26 52 L20 58" />
      <rect x="16" y="50" width="32" height="6" rx="1.5" />
    </Badge>
  );
}

export function BrewerPlaceholder({ className }: PlaceholderProps) {
  return (
    <Badge className={className}>
      <path d="M18 18 L46 18 L34 42 L30 42 Z" />
      <rect x="24" y="42" width="16" height="14" rx="2" />
    </Badge>
  );
}

export function AccessoryPlaceholder({ className }: PlaceholderProps) {
  return (
    <Badge className={className}>
      <rect x="16" y="16" width="32" height="32" rx="4" />
      <path d="M16 28 L48 28" />
      <path d="M28 16 L28 48" />
    </Badge>
  );
}

const PLACEHOLDER_BY_KIND = {
  grinder: GrinderPlaceholder,
  machine: MachinePlaceholder,
  brewer: BrewerPlaceholder,
  accessory: AccessoryPlaceholder,
};

export function ProductPlaceholder({ kind, className }: PlaceholderProps & { kind: keyof typeof PLACEHOLDER_BY_KIND }) {
  const Component = PLACEHOLDER_BY_KIND[kind] ?? AccessoryPlaceholder;
  return <Component className={className} />;
}

/** Fallback for beans without a label photo. */
export function BeanBagPlaceholder({ className }: PlaceholderProps) {
  return (
    <Badge className={className}>
      <path d="M24 12 C24 8, 40 8, 40 12 L40 18 L24 18 Z" />
      <path d="M22 18 C16 26, 16 50, 24 56 L40 56 C48 50, 48 26, 42 18 Z" />
      <circle cx="29" cy="34" r="2.4" />
      <circle cx="35" cy="40" r="2.4" />
      <circle cx="30" cy="45" r="2.4" />
    </Badge>
  );
}
