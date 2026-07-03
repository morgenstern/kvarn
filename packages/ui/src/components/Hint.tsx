import type { HTMLAttributes } from "react";

export function Hint({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`flex gap-2.5 bg-sage-soft rounded-2xl px-3.5 py-3 text-[13px] leading-relaxed text-[#3d4a3d] mt-3 ${className}`}
      {...props}
    />
  );
}
