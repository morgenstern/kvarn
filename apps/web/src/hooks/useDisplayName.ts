import { useCallback, useState } from "react";

const DISPLAY_NAME_KEY = "kvarn:displayName";

/** Purely for personalizing the Heute greeting — not tied to any account. */
export function useDisplayName() {
  const [displayName, setDisplayNameState] = useState(() => localStorage.getItem(DISPLAY_NAME_KEY) ?? "");

  const setDisplayName = useCallback((name: string) => {
    localStorage.setItem(DISPLAY_NAME_KEY, name);
    setDisplayNameState(name);
  }, []);

  return { displayName, setDisplayName };
}
