/**
 * Motif de vagues/reliefs NAVI — brief §33 : "Le motif graphique NAVI
 * composé de vagues/reliefs peut notamment être utilisé sur Login, sidebar,
 * zones de branding pertinentes." Reprend la logique graphique du mockup
 * (retours Phase C.5, 2026-09-01) : 3 reliefs superposés, en ondulation
 * continue jusqu'au bord droit — pas de forme qui s'arrête net.
 */
export function WaveBackground({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1200 400"
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M0,150 C140,115 260,175 430,145 C610,115 760,165 940,135 C1060,113 1130,122 1200,118 L1200,400 L0,400 Z"
        fill="#a9bcd4"
        opacity="0.55"
      />
      <path
        d="M0,205 C160,155 300,235 500,195 C690,157 840,220 1010,182 C1090,165 1150,172 1200,168 L1200,400 L0,400 Z"
        fill="#5c7455"
      />
      <path
        d="M0,255 C110,215 190,285 330,268 C470,251 555,308 675,288 C800,267 895,318 1000,298 C1080,283 1140,292 1200,286 L1200,400 L0,400 Z"
        fill="#be5e2e"
      />
    </svg>
  );
}
