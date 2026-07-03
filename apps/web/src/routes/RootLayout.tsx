import { useEffect } from "react";
import { Link, Outlet } from "@tanstack/react-router";
import { useKvarnStore } from "../state/store";
import { useT } from "../i18n";
import { useEnsureSession } from "../auth/useEnsureSession";

export function RootLayout() {
  const hydrate = useKvarnStore((s) => s.hydrate);
  const hydrated = useKvarnStore((s) => s.hydrated);
  const tCommon = useT("common");
  const tNav = useT("nav");
  const tSettings = useT("settings");
  useEnsureSession();

  const TABS = [
    { to: "/" as const, label: tNav("today"), isBrew: false },
    { to: "/regal" as const, label: tNav("shelf"), isBrew: false },
    { to: "/bruehen" as const, label: tNav("brew"), isBrew: true },
    { to: "/setup" as const, label: tNav("setup"), isBrew: false },
    { to: "/kompass" as const, label: tNav("compass"), isBrew: false },
  ];

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-birch text-muted">{tCommon("loading")}</div>
    );
  }

  return (
    <div className="min-h-screen bg-birch flex flex-col">
      <div className="max-w-md mx-auto w-full px-5 pt-2 flex justify-end">
        <Link to="/settings" className="text-[11px] text-muted underline">
          {tSettings("title")}
        </Link>
      </div>
      <main className="flex-1 max-w-md mx-auto w-full px-5 pt-1 pb-28">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-0 right-0 bg-birch/95 backdrop-blur border-t border-linen flex justify-around pt-2.5 z-20">
        {TABS.map((tab) => (
          <Link
            key={tab.to}
            to={tab.to}
            className="flex flex-col items-center gap-0.5 text-[10.5px] text-muted w-16 pb-2 [&.active]:text-copper [&.active]:font-medium"
            activeProps={{ className: "active" }}
            activeOptions={{ exact: tab.to === "/" }}
          >
            {tab.isBrew ? (
              <span className="-mt-6 w-[58px] h-[58px] rounded-full bg-copper text-white flex items-center justify-center shadow-lg shadow-copper/40 font-display text-2xl">
                +
              </span>
            ) : null}
            <span className={tab.isBrew ? "text-copper font-medium" : ""}>{tab.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
