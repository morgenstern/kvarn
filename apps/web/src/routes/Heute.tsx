import { useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button, Card } from "@kvarn/ui";
import { activeBean, activeSetup, equipmentProduct, useKvarnStore } from "../state/store";
import { localeCode, useLocale, useT } from "../i18n";

const ONBOARDING_SEEN_KEY = "kvarn:onboardingSeen";

export function Heute() {
  const state = useKvarnStore();
  const setup = activeSetup(state);
  const bean = activeBean(state);
  const grinder = equipmentProduct(state, setup?.grinderEquipmentId ?? null);
  const recentBrews = state.brews.slice(0, 3);
  const t = useT("heute");
  const { locale } = useLocale();
  const navigate = useNavigate();

  const needsOnboarding = !setup && !bean && !localStorage.getItem(ONBOARDING_SEEN_KEY);

  useEffect(() => {
    if (needsOnboarding) navigate({ to: "/onboarding" });
  }, [needsOnboarding, navigate]);

  if (!setup || !bean) {
    return (
      <div>
        <h1 className="font-display text-[28px] mt-3.5 mb-0.5">{t("title")}</h1>
        <p className="text-sm text-muted">{t("emptyHint")}</p>
        <Card>
          <p className="text-sm">
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
      <h1 className="font-display text-[28px] mt-3.5 mb-0.5">{t("title")}</h1>
      <p className="text-sm text-muted">{setup.name} · {bean.roaster} — {bean.name}</p>

      <Card>
        <div className="text-[11px] uppercase tracking-wider text-muted font-medium">{t("readyCard")}</div>
        <div className="flex justify-between mt-2 text-sm">
          <span>{t("grinderLabel")}</span>
          <span className="text-espresso">{grinder ? `${grinder.brand} ${grinder.model}` : t("customGear")}</span>
        </div>
        <div className="flex justify-between mt-1 text-sm">
          <span>{t("methodLabel")}</span>
          <span className="text-espresso">{setup.method}</span>
        </div>
        <Link to="/bruehen">
          <Button>{t("brewStart")}</Button>
        </Link>
      </Card>

      {recentBrews.length > 0 ? (
        <Card>
          <div className="text-[11px] uppercase tracking-wider text-muted font-medium mb-2">{t("recentBrews")}</div>
          {recentBrews.map((b) => (
            <div key={b.id} className="flex items-center gap-3 py-2 border-b border-linen last:border-b-0">
              <div className="w-9 h-9 rounded-xl bg-birch flex items-center justify-center font-display text-sm">
                {b.ratingTotal}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">{new Date(b.brewedAt).toLocaleDateString(localeCode(locale))}</div>
                <div className="text-xs text-muted">{b.grindSetting} · {b.doseG}g → {b.actualYieldG ?? b.targetYieldG}g</div>
              </div>
            </div>
          ))}
        </Card>
      ) : null}
    </div>
  );
}
