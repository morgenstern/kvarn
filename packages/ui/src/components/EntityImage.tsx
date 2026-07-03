import { BeanBagPlaceholder, ProductPlaceholder } from "./ProductPlaceholder";

type EntityKind = "grinder" | "machine" | "brewer" | "accessory" | "bean";

interface EntityImageProps {
  src?: string | null;
  kind: EntityKind;
  className?: string;
  alt?: string;
}

/**
 * Single drop-in for "show the real illustration/photo if we have one, else
 * a category placeholder" — used for equipment (grinder/machine/brewer/
 * accessory) and beans everywhere in the app.
 */
export function EntityImage({ src, kind, className = "", alt = "" }: EntityImageProps) {
  if (src) {
    return <img src={src} alt={alt} className={`object-cover ${className}`} />;
  }
  if (kind === "bean") return <BeanBagPlaceholder className={className} />;
  return <ProductPlaceholder kind={kind} className={className} />;
}
