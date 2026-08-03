import Link from "next/link";
import { Avatar } from "@/components/app/AppSidebar";
import { timeAgo } from "@/lib/format";
import type { Activity } from "@/app/app/dashboard-data";

export function RecentActivity({ items }: { items: Activity[] }) {
  return (
    <aside className="rounded-xl border bg-surface p-4">
      <h2 className="mb-3 text-sm font-bold text-ink">Recent activity</h2>
      {items.length === 0 ? (
        <p className="text-sm text-faint">No activity yet. Send a mockup to a client to start collecting views and feedback.</p>
      ) : (
        <ul className="space-y-3.5">
          {items.map((a, i) => (
            <li key={i}>
              <Link href={a.mockupId ? `/app/mockups/${a.mockupId}` : "#"} className="group flex gap-2.5">
                <span className="relative shrink-0">
                  <Avatar name={a.actor} email={a.email} size={30} />
                  <span
                    className="absolute -right-0.5 -bottom-0.5 grid h-3.5 w-3.5 place-items-center rounded-full ring-2 ring-[color:var(--color-surface)]"
                    style={{ background: a.kind === "comment" ? "var(--color-brand)" : "var(--color-success)" }}
                    aria-hidden
                  >
                    {a.kind === "comment" ? (
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none"><path d="M4 5h16v10H9l-5 4V5Z" stroke="#fff" strokeWidth="2.4" strokeLinejoin="round" /></svg>
                    ) : (
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke="#fff" strokeWidth="2.4" /></svg>
                    )}
                  </span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug text-ink">
                    <span className="font-semibold">{a.actor}</span>{" "}
                    <span className="text-muted">{a.kind === "view" ? "viewed" : "commented on"}</span>{" "}
                    <span className="font-medium text-brand-ink group-hover:underline">{a.mockupName}</span>
                  </p>
                  {a.snippet && <p className="mt-0.5 line-clamp-1 text-xs text-muted">“{a.snippet}”</p>}
                  <p className="mt-0.5 font-mono text-[0.6875rem] text-faint">{timeAgo(a.at)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
