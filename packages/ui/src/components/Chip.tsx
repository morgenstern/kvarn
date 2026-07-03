import type { ButtonHTMLAttributes } from "react";

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export function Chip({ active = false, className = "", ...props }: ChipProps) {
  const base =
    "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[14px] cursor-pointer select-none";
  const styles = active
    ? "bg-copper-soft border-copper text-[#7a4526]"
    : "bg-birch border-linen text-espresso";
  return <button type="button" className={`${base} ${styles} ${className}`} {...props} />;
}
