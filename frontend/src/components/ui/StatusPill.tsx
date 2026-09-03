type Status = "Excellent" | "Sain" | "À surveiller" | "Critique" | "Aucun scan" | "Erreur";

const STYLES: Record<Status, string> = {
  Excellent: "bg-sage-soft text-sage-ink",
  Sain: "bg-sage-soft text-sage-ink",
  "À surveiller": "bg-warn-soft text-warn",
  Critique: "bg-alert-soft text-alert",
  "Aucun scan": "bg-linen-deep text-graphite-faint",
  Erreur: "bg-alert-soft text-alert"
};

export function StatusPill({ status }: { status: Status }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}>
      {status}
    </span>
  );
}

export function TrendLabel({ delta, positiveIsGood = true }: { delta: number; positiveIsGood?: boolean }) {
  if (delta === 0) return <span className="text-xs text-graphite-faint">→ 0 pt</span>;
  const isPositive = delta > 0;
  const good = isPositive === positiveIsGood;
  return (
    <span className={`text-xs font-medium ${good ? "text-sage" : "text-alert"}`}>
      {isPositive ? "↑" : "↓"} {isPositive ? "+" : ""}
      {delta} pts
    </span>
  );
}
