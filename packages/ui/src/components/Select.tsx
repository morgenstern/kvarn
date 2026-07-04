import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { ChevronDown } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Listbox-style select (ARIA "select-only combobox" pattern), styled to
 * match the design system instead of the unthemeable native <select> popup.
 * Keyboard: ArrowUp/Down move the highlighted option (opening the list if
 * closed), Enter confirms the highlighted option, Escape closes without
 * changing the value, Home/End jump to the first/last option.
 */
export function Select({ value, onChange, options, placeholder, className = "", disabled = false }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listboxId = useId();

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selectedLabel = selectedIndex >= 0 ? options[selectedIndex]!.label : (placeholder ?? "");

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  useEffect(() => {
    if (open) setHighlighted(selectedIndex >= 0 ? selectedIndex : 0);
    // Only re-sync when the popup opens, not on every value/selectedIndex change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector(`[data-index="${highlighted}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, highlighted]);

  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((i) => Math.max(i - 1, 0));
    } else if (e.key === "Home") {
      e.preventDefault();
      setHighlighted(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setHighlighted(options.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const opt = options[highlighted];
      if (opt) onChange(opt.value);
      setOpen(false);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-activedescendant={open && options[highlighted] ? `${listboxId}-${highlighted}` : undefined}
        onClick={() => !disabled && setOpen((v) => !v)}
        onKeyDown={handleKeyDown}
        className="w-full flex items-center justify-between gap-2 border border-linen rounded-control px-3 py-2 text-base bg-birch text-left disabled:opacity-50"
      >
        <span className={`truncate ${selectedIndex < 0 ? "text-muted" : ""}`}>{selectedLabel}</span>
        <ChevronDown size={16} strokeWidth={1.5} className={`flex-none text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <ul
          ref={listRef}
          role="listbox"
          id={listboxId}
          className="absolute z-30 mt-1 w-full max-h-60 overflow-y-auto bg-card border border-linen rounded-control shadow-lg py-1"
        >
          {options.map((opt, i) => (
            <li
              key={opt.value}
              id={`${listboxId}-${i}`}
              role="option"
              aria-selected={opt.value === value}
              data-index={i}
              onMouseEnter={() => setHighlighted(i)}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`px-3 py-2 text-base cursor-pointer ${i === highlighted ? "bg-copper-soft text-espresso" : "text-espresso"} ${
                opt.value === value ? "font-medium" : ""
              }`}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
