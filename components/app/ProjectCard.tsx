import Link from "next/link";
import { timeAgo } from "@/lib/format";

function Cover({ url, name }: { url?: string; name: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="h-full w-full object-cover object-top" />;
  }
  return (
    <div className="grid h-full w-full place-items-center bg-brand-soft">
      <span className="font-mono text-3xl font-bold text-brand/40">{name.slice(0, 1).toUpperCase()}</span>
    </div>
  );
}

function Stat({ label, value, children }: { label: string; value: number; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5" title={label}>
      {children}
      {value}
    </span>
  );
}

export function ProjectCard({
  id,
  name,
  coverUrl,
  updatedAt,
  stats,
  menu,
}: {
  id: string;
  name: string;
  coverUrl?: string;
  updatedAt: string;
  stats: { mockups: number; comments: number; resolved: number };
  menu?: React.ReactNode;
}) {
  return (
    <div className="card card-hover group relative overflow-hidden">
      {menu && <div className="absolute right-2 top-2 z-10">{menu}</div>}
      <Link href={`/app/projects/${id}`} className="block">
        <div className="aspect-[16/10] w-full overflow-hidden border-b bg-canvas">
          <Cover url={coverUrl} name={name} />
        </div>
        <div className="p-4">
          <h3 className="truncate font-semibold text-ink">{name}</h3>
          <div className="mt-2 flex items-center gap-3 text-xs text-faint">
            <Stat label="mockups" value={stats.mockups}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.7" />
                <path d="m4 17 5-4 4 3 3-2 4 3" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
              </svg>
            </Stat>
            <Stat label="comments" value={stats.comments}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M4 5h16v10H9l-5 4V5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
              </svg>
            </Stat>
            <Stat label="resolved" value={stats.resolved}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="m5 12 4.5 4.5L19 7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Stat>
            <span className="ml-auto font-mono">{timeAgo(updatedAt)}</span>
          </div>
        </div>
      </Link>
    </div>
  );
}
