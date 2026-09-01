import { useEffect } from "react";
import { Icon } from "./icons.js";

export function Modal({
  title,
  onClose,
  children
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-graphite/40 px-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-card border border-graphite/10 bg-linen p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-display font-semibold text-graphite">{title}</h2>
          <button onClick={onClose} aria-label="Fermer" className="text-graphite-faint hover:text-graphite">
            <Icon.X width={18} height={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
