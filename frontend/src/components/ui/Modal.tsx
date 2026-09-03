import { useEffect } from "react";
import { Icon } from "./icons.js";

export function Modal({
  title,
  onClose,
  children,
  wide
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Contenu plus dense (ex. détail d'un scan) — largeur et hauteur max augmentées, scroll interne. */
  wide?: boolean;
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
        className={`flex w-full flex-col rounded-card border border-graphite/10 bg-linen p-5 shadow-lg ${
          wide ? "max-h-[85vh] max-w-2xl" : "max-w-md"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-display font-semibold text-graphite">{title}</h2>
          <button onClick={onClose} aria-label="Fermer" className="text-graphite-faint hover:text-graphite">
            <Icon.X width={18} height={18} />
          </button>
        </div>
        <div className={wide ? "overflow-y-auto" : undefined}>{children}</div>
      </div>
    </div>
  );
}
