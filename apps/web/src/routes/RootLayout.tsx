import { useEffect } from "react";
import { Link, Outlet } from "@tanstack/react-router";
import { useKvarnStore } from "../state/store";

const TABS = [
  { to: "/", label: "Heute", isBrew: false },
  { to: "/regal", label: "Regal", isBrew: false },
  { to: "/bruehen", label: "Brühen", isBrew: true },
  { to: "/setup", label: "Setup", isBrew: false },
  { to: "/kompass", label: "Kompass", isBrew: false },
] as const;

export function RootLayout() {
  const hydrate = useKvarnStore((s) => s.hydrate);
  const hydrated = useKvarnStore((s) => s.hydrated);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-birch text-muted">
        Kvarn lädt …
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-birch flex flex-col">
      <main className="flex-1 max-w-md mx-auto w-full px-5 pt-2 pb-28">
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
