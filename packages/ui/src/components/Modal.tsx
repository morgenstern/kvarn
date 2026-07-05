import type { ReactNode } from "react";
import { X } from "lucide-react";

interface ModalProps {
  onClose: () => void;
  children: ReactNode;
}

/**
 * Bottom sheet on mobile, centered dialog on wider screens. Backdrop click
 * and the corner close button both dismiss — callers own their own
 * save/cancel actions inside `children`, this just owns the chrome.
 */
export function Modal({ onClose, children }: ModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-charcoal/40"
      onClick={onClose}
    >
      <div
        className="bg-card w-full sm:max-w-md sm:rounded-card rounded-t-card max-h-[90vh] overflow-y-auto p-[18px] relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Schließen"
          className="absolute top-3 right-3 text-muted p-2 -m-2"
        >
          <X size={20} strokeWidth={1.5} />
        </button>
        {children}
      </div>
    </div>
  );
}
