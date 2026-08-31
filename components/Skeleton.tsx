/** A single placeholder bar. Width is a Tailwind class so callers vary the rhythm. */
export function Bar({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`skeleton h-3 ${className}`} />;
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  // uneven widths read as text; identical bars read as a broken layout
  const widths = ["w-3/5", "w-4/5", "w-2/5", "w-3/4", "w-1/2", "w-2/3"];
  return (
    <ul className="divide-y divide-line border-y border-line">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="space-y-2 py-4 pl-3">
          <Bar className={`h-4 ${widths[i % widths.length]}`} />
          <Bar className="w-1/3" />
          <div className="flex gap-1.5 pt-1">
            <Bar className="h-5 w-16" />
            <Bar className="h-5 w-20" />
          </div>
        </li>
      ))}
    </ul>
  );
}
