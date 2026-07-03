import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { de, type Dictionary } from "./de";
import { en } from "./en";

export type Locale = "de" | "en";

const DICTIONARIES: Record<Locale, Dictionary> = { de, en };
const LOCALE_KEY = "kvarn:locale";

function detectDefaultLocale(): Locale {
  const stored = localStorage.getItem(LOCALE_KEY);
  if (stored === "de" || stored === "en") return stored;
  return navigator.language.toLowerCase().startsWith("de") ? "de" : "en";
}

type Section = keyof Dictionary;

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectDefaultLocale);

  const setLocale = useCallback((next: Locale) => {
    localStorage.setItem(LOCALE_KEY, next);
    setLocaleState(next);
  }, []);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
}

/**
 * useT('setup') returns a `t(key, vars?)` function scoped to the "setup"
 * section of the dictionary — e.g. t('saveSetup'). Falls back to the raw key
 * if a translation is somehow missing rather than throwing.
 */
export function useT<S extends Section>(section: S) {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useT must be used within a LocaleProvider");
  const dict = DICTIONARIES[ctx.locale][section] as Record<string, unknown>;

  return useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      const raw = dict[key];
      if (typeof raw !== "string") return key;
      return interpolate(raw, vars);
    },
    [dict],
  );
}

/** Access to raw array-valued dictionary entries (tag option lists), and the current locale/switcher. */
export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within a LocaleProvider");
  return ctx;
}

/** BCP-47 code for Intl/toLocaleString APIs, matching the active UI language. */
export function localeCode(locale: Locale): string {
  return locale === "de" ? "de-DE" : "en-US";
}

export function useTags(section: "bruehen", key: "visualTags" | "flavorTags"): readonly string[] {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useTags must be used within a LocaleProvider");
  return DICTIONARIES[ctx.locale][section][key];
}
