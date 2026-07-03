import type { HTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";

interface SectionLabelProps extends HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon;
}

export function SectionLabel({ icon: Icon, className = "", children, ...props }: SectionLabelProps) {
  return (
    <div
      className={`flex items-center gap-1.5 text-[13px] uppercase tracking-wider text-muted font-medium mb-2 ${className}`}
      {...props}
    >
      {Icon ? <Icon size={15} strokeWidth={1.5} /> : null}
      {children}
    </div>
  );
}
