import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Card, EntityImage, ProductCard, SectionLabel } from "@kvarn/ui";
import { computeBeanAgeDays, freshnessPct } from "@kvarn/core";
import { Archive, Package, Plus } from "lucide-react";
import { useKvarnStore } from "../state/store";
import { BeanForm } from "../components/BeanForm";
import { useT } from "../i18n";

function beanFreshnessPct(roastDate: string | null): number | null {
  if (!roastDate) return null;
  return freshnessPct(computeBeanAgeDays(new Date(roastDate), new Date()));
}

export function Regal() {
  const { beans, archiveBean, activeBeanId, setActiveBean } = useKvarnStore();
  const navigate = useNavigate();
  const t = useT("regal");
  const tCommon = useT("common");
  const [showForm, setShowForm] = useState(false);

  return (
    <div>
      <h1 className="font-display text-[32px] mt-3.5 mb-0.5">{t("title")}</h1>
      <p className="text-base text-muted">{beans.length === 0 ? t("emptyState") : t("beanCount", { count: beans.length })}</p>

      <SectionLabel
        icon={Package}
        className="mt-5"
        action={
          <button
            type="button"
            className="flex items-center gap-1 text-[15px] text-copper underline py-2.5 px-1 -my-2.5 -mr-1"
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? null : <Plus size={15} strokeWidth={1.5} />}
            {showForm ? tCommon("cancel") : t("addBean")}
          </button>
        }
      >
        {t("yourBeans")}
      </SectionLabel>

      {showForm ? (
        <Card>
          <BeanForm onSaved={() => setShowForm(false)} />
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-3 mt-3">
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
              <div className="flex flex-col items-start mt-1 -mx-2">
                {activeBeanId === bean.id ? (
                  <span className="text-[13px] text-copper font-medium px-2 py-3">{tCommon("active")}</span>
                ) : (
                  <button
                    type="button"
                    className="text-[13px] text-muted underline px-2 py-3"
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
                  className="flex items-center gap-1 text-[13px] text-muted underline px-2 py-3"
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
