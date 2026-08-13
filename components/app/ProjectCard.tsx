import Link from "next/link";
import { timeAgo, plural } from "@/lib/format";
import { Avatar } from "@/components/app/AppSidebar";
import { HtmlThumbnail } from "@/components/viewer/HtmlThumbnail";

function Cover({ url, name, isHtml }: { url?: string; name: string; isHtml?: boolean }) {
  if (url && isHtml) {
    return <HtmlThumbnail url={url} className="h-full w-full" />;
  }
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" loading="lazy" className="media-in h-full w-full object-cover object-top" />;
  }
  return (
    <div className="grid h-full w-full place-items-center bg-brand-soft">
      <span className="font-mono text-3xl font-bold text-brand-ink/40">{name.slice(0, 1).toUpperCase()}</span>
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
  coverIsHtml,
  updatedAt,
  stats,
  menu,
  viewers,
  lastViewedAt,
}: {
  id: string;
  name: string;
  coverUrl?: string;
  coverIsHtml?: boolean;
  updatedAt: string;
  stats: { mockups: number; comments: number; resolved: number };
  menu?: React.ReactNode;
  viewers?: { name: string; email: string }[];
  lastViewedAt?: string | null;
}) {
  return (
    <div className="group relative">
      <Link href={`/app/projects/${id}`} className="block transition-transform duration-200 ease-out group-hover:-translate-y-0.5">
        {/* folder: a tab + body holding the inset preview */}
        <div className="relative">
          <div className="h-4 w-[42%] rounded-t-[14px]" style={{ background: "var(--secondary)" }} aria-hidden />
          <div className="rounded-2xl rounded-tl-none p-2.5 transition-colors group-hover:brightness-[0.99]" style={{ background: "var(--secondary)" }}>
            <div className="aspect-[16/10] w-full overflow-hidden rounded-xl bg-canvas ring-1 ring-[color:var(--border)]">
              <Cover url={coverUrl} name={name} isHtml={coverIsHtml} />
            </div>
          </div>
        </div>

        {/* meta */}
        <div className="px-2 pt-4">
          <h3 className="truncate text-[0.95rem] font-semibold text-ink">{name}</h3>
          <div className="mt-2.5 flex items-center gap-3.5 text-xs text-faint">
            <Stat label="files" value={stats.mockups}>
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

          <div className="mt-4 flex min-h-8 items-center justify-between gap-2 border-t pt-4">
            <div className="flex min-w-0 items-center gap-2">
              {viewers && viewers.length > 0 ? (
                <>
                  <div className="flex -space-x-2">
                    {viewers.slice(0, 4).map((v, i) => (
                      <span key={i} className="rounded-full ring-2 ring-[color:var(--color-canvas)]">
                        <Avatar name={v.name} email={v.email} size={22} />
                      </span>
                    ))}
                  </div>
                  <span className="truncate text-xs text-faint">
                    {plural(viewers.length, "viewer")}
                    {lastViewedAt ? ` · seen ${timeAgo(lastViewedAt)}` : ""}
                  </span>
                </>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs text-faint">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke="currentColor" strokeWidth="1.6" />
                    <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.6" />
                  </svg>
                  No views yet
                </span>
              )}
            </div>
            {menu && <div className="shrink-0">{menu}</div>}
          </div>
        </div>
      </Link>
    </div>
  );
}
