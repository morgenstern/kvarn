import type { HTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface SectionLabelProps extends HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon;
  /** Right-aligned control (e.g. an inline "+ Add" toggle) — the one shared
   * shape for "heading, add control, content below" used across the app. */
  action?: ReactNode;
}

export function SectionLabel({ icon: Icon, action, className = "", children, ...props }: SectionLabelProps) {
  return (
    <div className={`flex items-center justify-between gap-2 mb-2 ${className}`} {...props}>
      <div className="flex items-center gap-1.5 text-[13px] uppercase tracking-wider text-muted font-medium">
        {Icon ? <Icon size={15} strokeWidth={1.5} /> : null}
        {children}
      </div>
      {action}
    </div>
  );
}
