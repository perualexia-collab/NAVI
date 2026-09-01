/**
 * Motif de vagues/reliefs NAVI — brief §33 : "Le motif graphique NAVI
 * composé de vagues/reliefs peut notamment être utilisé sur Login, sidebar,
 * zones de branding pertinentes." Approximation géométrique tant que les
 * assets de marque définitifs ne sont pas intégrés.
 */
export function WaveBackground({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1200 320"
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M0,180 C200,120 350,220 600,170 C850,120 1000,200 1200,150 L1200,320 L0,320 Z"
        fill="#dbe4ed"
        opacity="0.7"
      />
      <path
        d="M0,220 C220,260 380,160 620,210 C860,260 1000,180 1200,210 L1200,320 L0,320 Z"
        fill="#5c7455"
      />
      <path
        d="M0,260 C260,220 420,290 680,250 C900,215 1050,270 1200,240 L1200,320 L0,320 Z"
        fill="#3a4a35"
        opacity="0.85"
      />
      <path
        d="M0,300 C180,280 300,300 480,290 L480,320 L0,320 Z"
        fill="#be5e2e"
      />
    </svg>
  );
}
