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

// A stylized millstone/mill wheel — grinders are literally "Mühlen" (mills),
// so this doubles as a small brand nod to the Kvarn name.
export function GrinderPlaceholder({ className }: PlaceholderProps) {
  return (
    <Badge className={className}>
      <circle cx="32" cy="32" r="21" />
      <circle cx="32" cy="32" r="6" />
      <line x1="32" y1="11" x2="32" y2="26" />
      <line x1="32" y1="38" x2="32" y2="53" />
      <line x1="13.8" y1="21" x2="27" y2="28.5" />
      <line x1="37" y1="35.5" x2="50.2" y2="43" />
      <line x1="50.2" y1="21" x2="37" y2="28.5" />
      <line x1="27" y1="35.5" x2="13.8" y2="43" />
    </Badge>
  );
}

// A stylized portafilter: basket with two locking-lug "ears" and a handle
// ending in a knob.
export function MachinePlaceholder({ className }: PlaceholderProps) {
  return (
    <Badge className={className}>
      <circle cx="24" cy="34" r="13" />
      <path d="M13 24 L9 19" />
      <path d="M35 24 L39 19" />
      <line x1="37" y1="34" x2="53" y2="34" />
      <circle cx="56" cy="34" r="3" />
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

/** Fallback for beans without a label photo — two overlapping coffee beans. */
export function BeanBagPlaceholder({ className }: PlaceholderProps) {
  return (
    <Badge className={className}>
      <g transform="rotate(-24 24 37)">
        <path d="M24 20 C33 20, 37 28, 37 37 C37 46, 33 54, 24 54 C15 54, 11 46, 11 37 C11 28, 15 20, 24 20 Z" />
        <path d="M24 22 C19 28, 19 46, 24 52" />
      </g>
      <g transform="rotate(18 42 27)">
        <path d="M42 14 C48 14, 51 20, 51 27 C51 34, 48 40, 42 40 C36 40, 33 34, 33 27 C33 20, 36 14, 42 14 Z" />
        <path d="M42 16 C38 20, 38 34, 42 38" />
      </g>
    </Badge>
  );
}
