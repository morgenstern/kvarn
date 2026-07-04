import { useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { Coffee, Compass, Settings as SettingsIcon, SlidersHorizontal, Sun } from "lucide-react";
import { Logo, LogoLockup } from "@kvarn/ui";
import { useKvarnStore } from "../state/store";
import { useT } from "../i18n";
import { useEnsureSession } from "../auth/useEnsureSession";

// Settings must stay reachable even mid-onboarding (e.g. to switch language or
// sign in) — everything else is gated behind having at least one setup + bean.
const ALLOWED_WITHOUT_ONBOARDING = ["/onboarding", "/settings"];

export function RootLayout() {
  const hydrate = useKvarnStore((s) => s.hydrate);
  const hydrated = useKvarnStore((s) => s.hydrated);
  const setups = useKvarnStore((s) => s.setups);
  const beans = useKvarnStore((s) => s.beans);
  const tCommon = useT("common");
  const tNav = useT("nav");
  const tSettings = useT("settings");
  useEnsureSession();
  const navigate = useNavigate();
  const location = useLocation();

  const TABS = [
    { to: "/" as const, label: tNav("today"), icon: Sun, isBrew: false },
    { to: "/regal" as const, label: tNav("shelf"), icon: Coffee, isBrew: false },
    { to: "/bruehen" as const, label: tNav("brew"), icon: Coffee, isBrew: true },
    { to: "/setup" as const, label: tNav("setup"), icon: SlidersHorizontal, isBrew: false },
    { to: "/kompass" as const, label: tNav("compass"), icon: Compass, isBrew: false },
  ];

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Mandatory onboarding: block every route until at least one setup and one
  // bean exist, except onboarding itself and settings. Onboarding always
  // creates both before it lets you finish (see Onboarding.tsx), so once
  // it's been seen this only re-triggers if all data was deleted since.
  const needsOnboarding = hydrated && (setups.length === 0 || beans.length === 0);
  useEffect(() => {
    if (needsOnboarding && !ALLOWED_WITHOUT_ONBOARDING.includes(location.pathname)) {
      navigate({ to: "/onboarding" });
    }
  }, [needsOnboarding, location.pathname, navigate]);

  if (!hydrated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-birch text-muted text-lg">
        <Logo size={40} spinning />
        {tCommon("loading")}
      </div>
    );
  }

  if (needsOnboarding && !ALLOWED_WITHOUT_ONBOARDING.includes(location.pathname)) {
    return null;
  }

  // The onboarding wizard is a focused, full-screen flow — showing the tab
  // bar during it would suggest the rest of the app is reachable, when
  // navigating away just bounces back here anyway.
  if (location.pathname === "/onboarding") {
    return (
      <div className="min-h-screen bg-birch flex flex-col">
        <div className="max-w-md mx-auto w-full px-5 pt-3 flex justify-end">
          <Link to="/settings" className="flex items-center gap-1.5 text-base text-muted">
            <SettingsIcon size={16} strokeWidth={1.5} />
            {tSettings("title")}
          </Link>
        </div>
        <div className="max-w-md mx-auto w-full px-5 pt-1 flex justify-center">
          <LogoLockup size={30} />
        </div>
        <main className="flex-1 max-w-md mx-auto w-full px-5 pt-2 pb-8">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-birch flex flex-col">
      <div className="max-w-md mx-auto w-full px-5 pt-3 flex items-center justify-between">
        <LogoLockup />
        <Link to="/settings" className="flex items-center gap-1.5 text-base text-muted">
          <SettingsIcon size={16} strokeWidth={1.5} />
          {tSettings("title")}
        </Link>
      </div>
      <main className="flex-1 max-w-md mx-auto w-full px-5 pt-2 pb-28">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-0 right-0 bg-birch/95 backdrop-blur border-t border-linen flex justify-around pt-2.5 z-20">
        {TABS.map((tab) => (
          <Link
            key={tab.to}
            to={tab.to}
            className="flex flex-col items-center gap-1 text-[15px] text-muted w-16 pb-2 [&.active]:text-copper [&.active]:font-medium"
            activeProps={{ className: "active" }}
            activeOptions={{ exact: tab.to === "/" }}
          >
            {tab.isBrew ? (
              <span className="-mt-6 w-[58px] h-[58px] rounded-full bg-copper text-white flex items-center justify-center shadow-lg shadow-copper/40">
                <tab.icon size={26} strokeWidth={1.5} />
              </span>
            ) : (
              <tab.icon size={22} strokeWidth={1.5} />
            )}
            <span className={tab.isBrew ? "text-copper font-medium" : ""}>{tab.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
