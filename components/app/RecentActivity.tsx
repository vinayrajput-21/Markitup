import Link from "next/link";
import { Avatar } from "@/components/app/AppSidebar";
import { timeAgo } from "@/lib/format";
import type { Activity } from "@/app/app/dashboard-data";

export function RecentActivity({ items }: { items: Activity[] }) {
  return (
    <aside className="rounded-xl border bg-surface p-4">
      <h2 className="mb-1 text-sm font-bold text-ink">Recent activity</h2>
      {items.length === 0 ? (
        <p className="pt-2 text-sm text-faint">No activity yet. Send a mockup to a client to start collecting views and feedback.</p>
      ) : (
        <ul className="divide-y">
          {items.map((a, i) => (
            <li key={i} className="py-2.5">
              <Link href={a.mockupId ? `/app/mockups/${a.mockupId}` : "#"} className="group flex items-center gap-2.5">
                <Avatar name={a.actor} email={a.email} size={26} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">
                    <span className="font-semibold">{a.actor}</span>{" "}
                    <span className="text-muted">{a.kind === "view" ? "viewed" : "commented on"}</span>{" "}
                    <span className="text-muted transition-colors group-hover:text-brand-ink">{a.mockupName}</span>
                  </span>
                  {a.snippet && <span className="mt-0.5 block truncate text-xs text-faint">“{a.snippet}”</span>}
                </span>
                <span className="shrink-0 self-start pt-0.5 font-mono text-[0.625rem] whitespace-nowrap text-faint">{timeAgo(a.at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
