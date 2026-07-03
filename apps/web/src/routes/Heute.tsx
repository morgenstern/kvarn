import { Link } from "@tanstack/react-router";
import { Button, Card, EntityImage, ProductCard, SectionLabel } from "@kvarn/ui";
import { Clock, Package, SlidersHorizontal } from "lucide-react";
import { activeBean, activeSetup, useKvarnStore } from "../state/store";
import { SetupThumbnail } from "../components/SetupThumbnail";
import { localeCode, useLocale, useT } from "../i18n";

export function Heute() {
  const state = useKvarnStore();
  const { setups, beans, activeSetupId, activeBeanId, setActiveSetup, setActiveBean } = state;
  const setup = activeSetup(state);
  const bean = activeBean(state);
  const recentBrews = state.brews.slice(0, 3);
  const t = useT("heute");
  const { locale } = useLocale();

  // RootLayout guarantees at least one setup+bean exist before this screen is
  // even reachable; this only covers the edge case where none is *active*
  // right now (e.g. the active one was archived).
  if (!setup || !bean) {
    return (
      <div>
        <h1 className="font-display text-[32px] mt-3.5 mb-0.5">{t("title")}</h1>
        <p className="text-base text-muted">{t("emptyHint")}</p>
        <Card>
          <p className="text-base">
            {t("emptyBefore")}
            <Link to="/setup" className="text-copper underline">
              {t("setupWord")}
            </Link>
            {t("emptyMid")}
            <Link to="/regal" className="text-copper underline">
              {t("beanWord")}
            </Link>
            {t("emptyAfter")}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-[32px] mt-3.5 mb-0.5">{t("title")}</h1>
      <p className="text-base text-muted">{setup.name} · {bean.roaster} — {bean.name}</p>

      <SectionLabel icon={SlidersHorizontal} className="mt-5">{t("grinderLabel")}</SectionLabel>
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-5 px-5">
        {setups.map((s) => (
          <ProductCard
            key={s.id}
            className="w-32 flex-none"
            active={activeSetupId === s.id}
            onClick={() => setActiveSetup(s.id)}
            image={<SetupThumbnail setup={s} />}
          >
            <div className="text-[14px] font-medium leading-tight truncate">{s.name}</div>
            <div className="text-[12px] text-muted truncate">{s.method}</div>
          </ProductCard>
        ))}
      </div>

      <SectionLabel icon={Package} className="mt-5">{t("beanWord")}</SectionLabel>
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-5 px-5">
        {beans.map((b) => (
          <ProductCard
            key={b.id}
            className="w-32 flex-none"
            active={activeBeanId === b.id}
            onClick={() => setActiveBean(b.id)}
            image={<EntityImage src={b.photoUrl} kind="bean" className="w-full h-full" />}
          >
            <div className="text-[14px] font-medium leading-tight truncate">{b.roaster}</div>
            <div className="text-[12px] text-muted truncate">{b.name}</div>
          </ProductCard>
        ))}
      </div>

      <Link to="/bruehen">
        <Button>{t("brewStart")}</Button>
      </Link>

      {recentBrews.length > 0 ? (
        <Card>
          <SectionLabel icon={Clock}>{t("recentBrews")}</SectionLabel>
          {recentBrews.map((b) => (
            <div key={b.id} className="flex items-center gap-3 py-2 border-b border-linen last:border-b-0">
              <div className="w-9 h-9 rounded-xl bg-birch flex items-center justify-center font-display text-base">
                {b.ratingTotal}
              </div>
              <div className="flex-1">
                <div className="text-base font-medium">{new Date(b.brewedAt).toLocaleDateString(localeCode(locale))}</div>
                <div className="text-sm text-muted">{b.grindSetting} · {b.doseG}g → {b.actualYieldG ?? b.targetYieldG}g</div>
              </div>
            </div>
          ))}
        </Card>
      ) : null}
    </div>
  );
}
