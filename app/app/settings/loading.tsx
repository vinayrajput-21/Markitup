import { Skeleton } from "@/components/ui/Skeleton";

export default function SettingsLoading() {
  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <div className="mb-7 space-y-2">
        <Skeleton className="h-7 w-32 rounded" />
        <Skeleton className="h-3 w-64 rounded" />
      </div>
      <div className="grid gap-8 md:grid-cols-[13rem_1fr]">
        {/* left nav */}
        <div className="space-y-1.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-md" />
          ))}
        </div>
        {/* panel */}
        <div className="space-y-5">
          <Skeleton className="h-6 w-40 rounded" />
          <Skeleton className="h-4 w-full max-w-lg rounded" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <div className="grid gap-5 lg:grid-cols-2">
            <Skeleton className="h-56 w-full rounded-xl" />
            <Skeleton className="h-56 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
