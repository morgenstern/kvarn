import { useMemo, useState } from "react";
import { Button } from "@kvarn/ui";
import { generateIllustrationFromPhoto, uploadPhoto } from "@kvarn/api-client";
import type { Bean } from "@kvarn/db";
import { Camera, Search } from "lucide-react";
import { useKvarnStore } from "../state/store";
import { useT } from "../i18n";

/**
 * Bean-adding form — shared by Regal (the shelf's "add bean" card) and
 * Onboarding's bean step, so both offer the same catalog search plus manual
 * fallback. Doesn't hide or navigate away after saving, so callers can let
 * users add more than one bean in a row.
 */
export function BeanForm({ onSaved, submitLabel }: { onSaved?: (bean: Bean) => void; submitLabel?: string }) {
  const { products, addBean, setBeanImage } = useKvarnStore();
  const t = useT("regal");
  const [beanQuery, setBeanQuery] = useState("");
  const [roaster, setRoaster] = useState("");
  const [name, setName] = useState("");
  const [origin, setOrigin] = useState("");
  const [roastDate, setRoastDate] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | undefined>();
  const [photoUploading, setPhotoUploading] = useState(false);

  const beanCatalogMatches = useMemo(() => {
    if (!beanQuery) return [];
    const q = beanQuery.toLowerCase();
    return products.filter((p) => p.kind === "bean" && `${p.brand} ${p.model}`.toLowerCase().includes(q)).slice(0, 8);
  }, [products, beanQuery]);

  function pickBeanFromCatalog(productId: string) {
    const p = products.find((pr) => pr.id === productId);
    if (!p) return;
    setRoaster(p.brand);
    setName(p.model);
    const specOrigin = p.specs && typeof p.specs.origin === "string" ? p.specs.origin : "";
    setOrigin(specOrigin);
    setBeanQuery("");
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    try {
      setPhotoUrl(await uploadPhoto(file));
    } catch {
      // Photo is a nice-to-have, never blocks saving the bean.
      setPhotoUrl(undefined);
    } finally {
      setPhotoUploading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!roaster || !name) return;
    const bean = await addBean({ roaster, name, origin: origin || undefined, roastDate: roastDate || undefined, photoUrl });
    if (photoUrl) {
      // Best-effort: the raw photo already shows fine — the generated
      // illustration just swaps in once/if it's ready.
      generateIllustrationFromPhoto({ photoUrl, label: `${roaster} ${name}`, kind: "bean" })
        .then((result) => setBeanImage(bean.id, result.imageUrl))
        .catch(() => {});
    }
    setRoaster("");
    setName("");
    setOrigin("");
    setRoastDate("");
    setPhotoUrl(undefined);
    onSaved?.(bean);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="flex items-center gap-1.5 text-sm text-muted -mb-1">
        <Search size={14} strokeWidth={1.5} />
        {t("searchBeanHint")}
      </div>
      <input
        className="border border-linen rounded-control px-3 py-2 text-base bg-birch"
        placeholder={t("searchBeanPlaceholder")}
        value={beanQuery}
        onChange={(e) => setBeanQuery(e.target.value)}
      />
      {beanCatalogMatches.length > 0 ? (
        <div className="-mt-1 flex flex-col">
          {beanCatalogMatches.map((p) => (
            <button
              key={p.id}
              type="button"
              className="w-full text-left text-base py-2.5 border-b border-linen last:border-b-0"
              onClick={() => pickBeanFromCatalog(p.id)}
            >
              <span className="font-medium">{p.brand}</span> — {p.model}
            </button>
          ))}
        </div>
      ) : null}
      <p className="text-sm text-muted -mb-2">{t("orEnterManually")}</p>
      <input
        className="border border-linen rounded-control px-3 py-2 text-base bg-birch"
        placeholder={t("roasterPlaceholder")}
        value={roaster}
        onChange={(e) => setRoaster(e.target.value)}
        required
      />
      <input
        className="border border-linen rounded-control px-3 py-2 text-base bg-birch"
        placeholder={t("namePlaceholder")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <input
        className="border border-linen rounded-control px-3 py-2 text-base bg-birch"
        placeholder={t("originPlaceholder")}
        value={origin}
        onChange={(e) => setOrigin(e.target.value)}
      />
      <label className="text-sm text-muted -mb-2">{t("roastDateLabel")}</label>
      <input
        type="date"
        className="border border-linen rounded-control px-3 py-2 text-base bg-birch"
        value={roastDate}
        onChange={(e) => setRoastDate(e.target.value)}
      />
      <label className="text-sm text-muted -mb-2 flex items-center gap-1.5">
        <Camera size={15} strokeWidth={1.5} />
        {t("photoLabel")}
      </label>
      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} className="text-base" />
      {photoUploading ? <p className="text-sm text-muted">{t("photoUploading")}</p> : null}
      {photoUrl ? <img src={photoUrl} alt="" className="w-20 h-20 object-cover rounded-control" /> : null}
      <Button type="submit">{submitLabel ?? t("saveBean")}</Button>
    </form>
  );
}
