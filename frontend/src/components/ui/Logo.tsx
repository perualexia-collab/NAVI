/**
 * Assets de marque NAVI réels — frontend/public/brand/{mark,logo-full}.png
 * (retours Phase C.5, 2026-09-01). Ne pas recréer/réinterpréter en CSS ou
 * texte : ces fichiers sont la référence exacte fournie.
 */
export function LogoMark({ size = 28 }: { size?: number }) {
  return <img src="/brand/mark.png" alt="NAVI" width={size} height={size} style={{ objectFit: "contain" }} />;
}

export function LogoFull({ className = "h-20" }: { className?: string }) {
  return <img src="/brand/logo-full.png" alt="NAVI — Navigate. Analyze. Act." className={`mx-auto ${className}`} />;
}
