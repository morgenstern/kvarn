import type { HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`bg-card border border-linen rounded-card p-[18px] mt-3.5 ${className}`}
      {...props}
    />
  );
}
