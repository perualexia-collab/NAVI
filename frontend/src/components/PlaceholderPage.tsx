interface PlaceholderPageProps {
  title: string;
  description: string;
}

/** Gabarit temporaire des sections — remplacé écran par écran en Phase B (données mockées, fidèles aux mockups). */
export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div>
      <h1 className="text-2xl">{title}</h1>
      <p className="mt-2 max-w-lg text-sm text-graphite-soft">{description}</p>
      <div className="mt-6 inline-block rounded-full bg-horizon-soft px-3 py-1 text-xs font-medium text-horizon-ink">
        Écran construit en Phase B
      </div>
    </div>
  );
}
