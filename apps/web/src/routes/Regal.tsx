import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button, Card, EntityImage, ProductCard } from "@kvarn/ui";
import { generateIllustrationFromPhoto, uploadPhoto } from "@kvarn/api-client";
import { computeBeanAgeDays, freshnessPct } from "@kvarn/core";
import { Archive, Camera, Plus } from "lucide-react";
import { useKvarnStore } from "../state/store";
import { useT } from "../i18n";

function beanFreshnessPct(roastDate: string | null): number | null {
  if (!roastDate) return null;
  return freshnessPct(computeBeanAgeDays(new Date(roastDate), new Date()));
}

export function Regal() {
  const { beans, addBean, archiveBean, activeBeanId, setActiveBean, setBeanImage } = useKvarnStore();
  const navigate = useNavigate();
  const t = useT("regal");
  const tCommon = useT("common");
  const [showForm, setShowForm] = useState(false);
  const [roaster, setRoaster] = useState("");
  const [name, setName] = useState("");
  const [origin, setOrigin] = useState("");
  const [roastDate, setRoastDate] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | undefined>();
  const [photoUploading, setPhotoUploading] = useState(false);

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
    setShowForm(false);
  }

  return (
    <div>
      <h1 className="font-display text-[32px] mt-3.5 mb-0.5">{t("title")}</h1>
      <p className="text-base text-muted">{beans.length === 0 ? t("emptyState") : t("beanCount", { count: beans.length })}</p>

      {showForm ? (
        <Card>
          <form onSubmit={submit} className="flex flex-col gap-3">
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
            <Button type="submit">{t("saveBean")}</Button>
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
              {tCommon("cancel")}
            </Button>
          </form>
        </Card>
      ) : (
        <Button onClick={() => setShowForm(true)}>
          <Plus size={18} strokeWidth={1.5} />
          {t("addBean")}
        </Button>
      )}

      <div className="grid grid-cols-2 gap-3">
        {beans.map((bean) => {
          const fresh = beanFreshnessPct(bean.roastDate);
          return (
            <ProductCard
              key={bean.id}
              active={activeBeanId === bean.id}
              onClick={() => navigate({ to: "/regal/$beanId", params: { beanId: bean.id } })}
              image={<EntityImage src={bean.imageUrl ?? bean.photoUrl} kind="bean" className="w-full h-full" />}
            >
              <div className="text-[15px] font-medium leading-tight">{bean.roaster}</div>
              <div className="text-[13px] text-muted truncate">{bean.name}{bean.origin ? ` · ${bean.origin}` : ""}</div>
              {fresh !== null ? (
                <div className="h-[5px] rounded-full bg-linen mt-2 overflow-hidden">
                  <div className="h-full rounded-full bg-sage" style={{ width: `${fresh}%` }} />
                </div>
              ) : null}
              <div className="flex items-center justify-between mt-2">
                {activeBeanId === bean.id ? (
                  <span className="text-[13px] text-copper font-medium">{tCommon("active")}</span>
                ) : (
                  <button
                    type="button"
                    className="text-[13px] text-muted underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveBean(bean.id);
                    }}
                  >
                    {tCommon("setActive")}
                  </button>
                )}
                <button
                  type="button"
                  className="flex items-center gap-1 text-[13px] text-muted underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    archiveBean(bean.id);
                  }}
                >
                  <Archive size={13} strokeWidth={1.5} />
                  {tCommon("archive")}
                </button>
              </div>
            </ProductCard>
          );
        })}
      </div>
    </div>
  );
}
