import { Icon } from "./icons.js";

export function StarRating({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-terracotta">
      {Array.from({ length: 5 }, (_, i) => (
        <Icon.Star key={i} width={11} height={11} fill={i < value ? "currentColor" : "none"} className={i < value ? "" : "text-graphite/25"} />
      ))}
    </span>
  );
}
