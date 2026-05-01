interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded bg-[var(--field)] ${className}`}
    />
  );
}

export function SkeletonItem() {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1">
        <Skeleton className="mb-2 h-4 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="mt-1 h-3 w-1/2" />
      </div>
      <Skeleton className="mt-1 h-3 w-16 shrink-0" />
    </div>
  );
}

export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="divide-y divide-[var(--line)]">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonItem key={i} />
      ))}
    </div>
  );
}
