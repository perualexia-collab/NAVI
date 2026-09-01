import { useState } from "react";

/**
 * Charge le logo réel (frontend/public/brand/mark.svg ou logo-full.svg)
 * s'il est présent ; retombe sur un wordmark texte sinon. À supprimer le
 * jour où les assets de marque définitifs sont intégrés durablement.
 */
export function LogoMark({ size = 28 }: { size?: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div
        className="flex items-center justify-center rounded-lg bg-sage font-display font-semibold text-white"
        style={{ width: size, height: size, fontSize: size * 0.5 }}
      >
        N
      </div>
    );
  }
  return <img src="/brand/mark.svg" alt="NAVI" width={size} height={size} onError={() => setFailed(true)} />;
}

export function LogoFull({ tagline = true }: { tagline?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="text-center">
        <div className="font-display text-2xl font-semibold tracking-wide">NAVI</div>
        {tagline && (
          <div className="mt-1 text-[10px] uppercase tracking-[0.25em] text-graphite-faint">
            <span className="text-terracotta">Navigate.</span> <span className="text-sage">Analyze.</span>{" "}
            <span className="text-horizon">Act.</span>
          </div>
        )}
      </div>
    );
  }
  return (
    <img
      src="/brand/logo-full.svg"
      alt="NAVI — Navigate. Analyze. Act."
      className="mx-auto h-20"
      onError={() => setFailed(true)}
    />
  );
}
