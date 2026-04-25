import { cn } from "@/lib/cn";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded bg-gray-200/80",
        className,
      )}
    />
  );
}

export function AARSkeleton() {
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-[92%]" />
          <Skeleton className="h-3 w-[78%]" />
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-12" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-lg border border-gray-200 bg-white p-3 space-y-2">
              <div className="flex gap-2">
                <Skeleton className="h-4 w-14 rounded-full" />
                <Skeleton className="h-4 w-24 rounded-full" />
              </div>
              <Skeleton className="h-3.5 w-[90%]" />
              <Skeleton className="h-3 w-[70%]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PCRSkeleton() {
  return (
    <div className="p-4 space-y-3">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-[88%]" />
      <Skeleton className="h-3 w-[94%]" />
      <Skeleton className="h-3 w-[60%]" />
      <Skeleton className="h-4 w-1/3 mt-4" />
      <Skeleton className="h-3 w-[80%]" />
      <Skeleton className="h-3 w-[72%]" />
      <Skeleton className="h-3 w-[90%]" />
    </div>
  );
}
