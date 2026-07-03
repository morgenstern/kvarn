import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "solid" | "ghost";
}

export function Button({ variant = "solid", className = "", ...props }: ButtonProps) {
  const base =
    "flex items-center justify-center gap-2 w-full border-none cursor-pointer font-sans text-lg font-medium rounded-control py-4 mt-4 transition-transform active:scale-[.98]";
  const styles =
    variant === "solid"
      ? "bg-copper text-white"
      : "bg-transparent text-espresso border border-linen";
  return <button className={`${base} ${styles} ${className}`} {...props} />;
}
