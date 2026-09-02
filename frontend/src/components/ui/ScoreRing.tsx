import { scoreTone, toneHex } from "./score-color.js";

interface ScoreRingProps {
  score: number | null;
  size?: number;
  strokeWidth?: number;
}

/** Jauge circulaire de score /100 — utilisée pour la santé CRM (hôtel, portefeuille, accueil). */
export function ScoreRing({ score, size = 64, strokeWidth = 6 }: ScoreRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = score === null ? 0 : Math.max(0, Math.min(100, score)) / 100;
  const color = toneHex[scoreTone(score)];
  // Le score doit rester lisible/visible quelle que soit la taille de
  // l'anneau (retours Phase C.5) — police proportionnelle à `size`, pas une
  // taille fixe qui se perd dans les grands cercles.
  const scoreFontSize = Math.max(11, Math.round(size * 0.3));
  const suffixFontSize = Math.max(7, Math.round(size * 0.14));

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5d9c1" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          style={{ transition: "stroke-dashoffset 0.4s ease" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="flex flex-col items-center leading-none">
          <span className="font-display font-semibold tabular-nums" style={{ fontSize: scoreFontSize, lineHeight: 1 }}>
            {score === null ? "—" : Math.round(score)}
          </span>
          {score !== null && (
            <span className="text-graphite-faint" style={{ fontSize: suffixFontSize, lineHeight: 1.5 }}>
              /100
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
