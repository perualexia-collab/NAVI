import type { HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-card border border-graphite/10 bg-linen p-5 shadow-sm ${className}`}
      {...props}
    />
  );
}

export function CardHeader({
  icon,
  title,
  action
}: {
  icon?: React.ReactNode;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm font-medium text-graphite">
        {icon}
        {title}
      </div>
      {action}
    </div>
  );
}
