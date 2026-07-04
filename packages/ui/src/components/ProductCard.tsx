import type { HTMLAttributes, ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";

interface ProductCardProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  image: ReactNode;
  active?: boolean;
  children: ReactNode;
}

/**
 * E-commerce-style card for equipment/beans: a large square image up top
 * (real illustration or category placeholder via EntityImage) with details
 * below. `children` carries the details block so callers can mix in
 * whatever a setup card vs. a bean card needs (freshness bar, archive link,
 * active label, ...) instead of a rigid title/subtitle shape.
 */
export function ProductCard({ image, active = false, children, className = "", ...props }: ProductCardProps) {
  return (
    <div
      className={`relative flex flex-col bg-linen border rounded-card overflow-hidden ${
        active ? "border-copper" : "border-linen"
      } ${props.onClick ? "cursor-pointer active:scale-[.98] transition-transform" : ""} ${className}`}
      {...props}
    >
      <div className="aspect-square w-full bg-linen relative">
        {image}
        {active ? (
          <span className="absolute top-2 right-2 text-copper bg-white rounded-full leading-none">
            <CheckCircle2 size={22} strokeWidth={1.5} />
          </span>
        ) : null}
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}
