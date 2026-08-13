import { Skeleton } from "@/components/ui/Skeleton";

export default function MockupLoading() {
  return (
    <div className="flex h-full flex-col">
      {/* top bar */}
      <div className="flex h-11 shrink-0 items-center gap-2 border-b bg-surface px-2.5">
        <Skeleton className="h-7 w-7 rounded-md" />
        <Skeleton className="h-4 w-40 rounded" />
        <div className="ml-auto flex items-center gap-2">
          <Skeleton className="h-7 w-24 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* comment rail */}
        <aside className="flex w-80 shrink-0 flex-col border-r bg-surface">
          <div className="space-y-3 border-b p-3">
            <Skeleton className="h-4 w-24 rounded" />
            <Skeleton className="h-8 w-full rounded-md" />
          </div>
          <div className="space-y-4 p-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <Skeleton className="h-6 w-6 shrink-0 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-1/2 rounded" />
                  <Skeleton className="h-3 w-full rounded" />
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* canvas */}
        <div className="grid min-h-0 flex-1 place-items-center bg-canvas p-6">
          <Skeleton className="h-[70%] w-full max-w-3xl rounded-lg" />
        </div>
      </div>
    </div>
  );
}
