import { Skeleton } from "@/components/ui/Skeleton";

export default function ProjectLoading() {
  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-52 rounded" />
          <Skeleton className="h-3 w-32 rounded" />
        </div>
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>

      {/* add-content panels */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>

      {/* tabs + search */}
      <div className="mb-5 flex items-center justify-between">
        <Skeleton className="h-8 w-48 rounded-md" />
        <Skeleton className="h-9 w-56 rounded-md" />
      </div>

      {/* files grid */}
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card overflow-hidden">
            <Skeleton className="aspect-[4/3] w-full !rounded-none" />
            <div className="space-y-2 p-3">
              <Skeleton className="h-3.5 w-2/3 rounded" />
              <Skeleton className="h-3 w-10 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
