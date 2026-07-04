import { useMemo, useState } from "react";
import { Button, Card, EntityImage, ProductCard, SectionLabel } from "@kvarn/ui";
import { generateIllustrationFromPhoto, submitProduct, uploadPhoto } from "@kvarn/api-client";
import type { LucideIcon } from "lucide-react";
import { Camera, Users } from "lucide-react";
import { exampleEquipment } from "../utils/exampleEquipment";
import { useKvarnStore } from "../state/store";
import { useT } from "../i18n";

type SubmissionState = "idle" | "submitting" | "submitted" | "error";

/**
 * Search-or-add-custom picker for a single equipment kind — shared by Setup
 * (always-visible, one section per kind) and Onboarding's grinder/machine
 * steps (same component, so picking/adding gear works identically and stays
 * in sync as this evolves). Doesn't navigate away or hide itself after an
 * add, so callers can let users add more than one piece in a row.
 */
export function EquipmentSearchSection({
  kind,
  icon,
  title,
  placeholder,
  onAdded,
}: {
  kind: "grinder" | "machine";
  icon: LucideIcon;
  title: string;
  placeholder: string;
  onAdded?: (equipmentId: string) => void;
}) {
  const { products, addEquipmentFromProduct, addCustomEquipment, setEquipmentImage } = useKvarnStore();
  const t = useT("setup");
  const [query, setQuery] = useState("");
  const examples = useMemo(() => exampleEquipment(products, kind), [products, kind]);
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [submitBrand, setSubmitBrand] = useState("");
  const [submitModel, setSubmitModel] = useState("");
  const [submissionState, setSubmissionState] = useState<SubmissionState>("idle");
  const [customPhotoFile, setCustomPhotoFile] = useState<File | null>(null);
  const [customPhotoBusy, setCustomPhotoBusy] = useState(false);

  const filteredProducts = useMemo(() => {
    if (!query) return [];
    const q = query.toLowerCase();
    return products.filter((p) => p.kind === kind && `${p.brand} ${p.model}`.toLowerCase().includes(q)).slice(0, 8);
  }, [products, query, kind]);

  async function handleAddCustom() {
    setCustomPhotoBusy(true);
    try {
      const photoUrl = customPhotoFile ? await uploadPhoto(customPhotoFile).catch(() => undefined) : undefined;
      const created = await addCustomEquipment(query, kind, photoUrl);
      const label = query;
      setQuery("");
      setCustomPhotoFile(null);
      onAdded?.(created.id);
      if (photoUrl) {
        // Best-effort: the raw photo (or a placeholder) already shows fine —
        // the generated illustration just swaps in once/if it's ready.
        generateIllustrationFromPhoto({ photoUrl, label, kind })
          .then((result) => setEquipmentImage(created.id, result.imageUrl))
          .catch(() => {});
      }
    } finally {
      setCustomPhotoBusy(false);
    }
  }

  return (
    <Card>
      <SectionLabel icon={icon}>{title}</SectionLabel>
      <input
        className="border border-linen rounded-control px-3 py-2 text-base bg-birch w-full"
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {!query && examples.length > 0 ? (
        <div className="mt-3">
          <p className="text-[13px] text-muted mb-1.5">{t("popularExamples")}</p>
          <div className="flex gap-3 overflow-x-auto pb-1 -mx-[18px] px-[18px]">
            {examples.map((p) => (
              <ProductCard
                key={p.id}
                className="w-24 flex-none"
                image={<EntityImage src={p.imageUrl} kind={kind} className="w-full h-full" />}
                onClick={async () => {
                  const created = await addEquipmentFromProduct(p.id);
                  onAdded?.(created.id);
                }}
              >
                <div className="text-[12px] font-medium leading-tight truncate">
                  {p.brand} {p.model}
                </div>
              </ProductCard>
            ))}
          </div>
        </div>
      ) : null}
      {filteredProducts.map((p) => (
        <button
          key={p.id}
          type="button"
          className="w-full text-left text-base py-2.5 border-b border-linen last:border-b-0 flex items-center gap-3"
          onClick={async () => {
            const created = await addEquipmentFromProduct(p.id);
            setQuery("");
            onAdded?.(created.id);
          }}
        >
          <EntityImage src={p.imageUrl} kind={kind} className="w-14 h-14 rounded-control flex-none" />
          {p.brand} {p.model}
        </button>
      ))}
      {query && filteredProducts.length === 0 ? (
        <div className="mt-2 flex flex-col gap-2 items-start">
          <label className="flex items-center gap-1.5 text-[13px] text-muted cursor-pointer py-2.5 -my-2.5">
            <Camera size={14} strokeWidth={1.5} />
            {customPhotoFile ? customPhotoFile.name : t("addPhotoOptional")}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => setCustomPhotoFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <button
            type="button"
            className="text-[15px] text-copper underline py-2.5 -my-2.5"
            disabled={customPhotoBusy}
            onClick={handleAddCustom}
          >
            {customPhotoBusy ? t("photoUploading") : t("addAsCustom", { query })}
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 text-[15px] text-copper underline py-2.5 -my-2.5"
            onClick={() => {
              setSubmitBrand(query.split(" ")[0] ?? query);
              setSubmitModel(query.split(" ").slice(1).join(" "));
              setShowSubmitForm(true);
              setSubmissionState("idle");
            }}
          >
            <Users size={15} strokeWidth={1.5} />
            {t("suggestForCommunity")}
          </button>
        </div>
      ) : null}

      {showSubmitForm ? (
        <div className="mt-3 pt-3 border-t border-linen flex flex-col gap-2">
          <p className="text-sm text-muted">{t("submitIntro")}</p>
          <input
            className="border border-linen rounded-control px-3 py-2 text-base bg-birch"
            placeholder={t("brandPlaceholder")}
            value={submitBrand}
            onChange={(e) => setSubmitBrand(e.target.value)}
          />
          <input
            className="border border-linen rounded-control px-3 py-2 text-base bg-birch"
            placeholder={t("modelPlaceholder")}
            value={submitModel}
            onChange={(e) => setSubmitModel(e.target.value)}
          />
          <Button
            disabled={!submitBrand || !submitModel || submissionState === "submitting"}
            onClick={async () => {
              setSubmissionState("submitting");
              try {
                await submitProduct({ kind, brand: submitBrand, model: submitModel });
                setSubmissionState("submitted");
                setSubmitBrand("");
                setSubmitModel("");
              } catch {
                setSubmissionState("error");
              }
            }}
          >
            {t("submit")}
          </Button>
          {submissionState === "submitted" ? <p className="text-sm text-sage">{t("submitted")}</p> : null}
          {submissionState === "error" ? <p className="text-sm text-clay">{t("submitError")}</p> : null}
        </div>
      ) : null}
    </Card>
  );
}
