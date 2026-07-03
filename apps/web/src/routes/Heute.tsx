import { Link } from "@tanstack/react-router";
import { Button, Card, SectionLabel } from "@kvarn/ui";
import { Clock, Coffee, SlidersHorizontal } from "lucide-react";
import { activeBean, activeSetup, equipmentProduct, useKvarnStore } from "../state/store";
import { localeCode, useLocale, useT } from "../i18n";

export function Heute() {
  const state = useKvarnStore();
  const setup = activeSetup(state);
  const bean = activeBean(state);
  const grinder = equipmentProduct(state, setup?.grinderEquipmentId ?? null);
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

      <Card>
        <SectionLabel className="mb-0">{t("readyCard")}</SectionLabel>
        <div className="flex justify-between mt-2 text-base">
          <span className="flex items-center gap-1.5">
            <SlidersHorizontal size={16} strokeWidth={1.5} />
            {t("grinderLabel")}
          </span>
          <span className="text-espresso">{grinder ? `${grinder.brand} ${grinder.model}` : t("customGear")}</span>
        </div>
        <div className="flex justify-between mt-1 text-base">
          <span className="flex items-center gap-1.5">
            <Coffee size={16} strokeWidth={1.5} />
            {t("methodLabel")}
          </span>
          <span className="text-espresso">{setup.method}</span>
        </div>
        <Link to="/bruehen">
          <Button>{t("brewStart")}</Button>
        </Link>
      </Card>

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
