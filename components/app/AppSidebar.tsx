"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Vivid, evenly-spaced hues — all readable with white text.
const AVATAR_COLORS = [
  "#dc2626", "#ea580c", "#d97706", "#ca8a04", "#65a30d", "#16a34a",
  "#059669", "#0d9488", "#0891b2", "#0284c7", "#2563eb", "#4f46e5",
  "#7c3aed", "#9333ea", "#c026d3", "#db2777", "#e11d48",
];

function seedHash(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

// One or two letters: initials of a name, else the first letters of the email.
function initialsOf(name: string, email: string) {
  const clean = (name || "").trim();
  if (clean) {
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return clean.slice(0, 2).toUpperCase();
  }
  const local = (email || "").split("@")[0];
  return local ? local.slice(0, 2).toUpperCase() : "?";
}

// A colored circle with the person's initials — deterministic per person.
export function Avatar({
  name,
  email,
  size = 32,
}: {
  name: string;
  email: string;
  size?: number;
}) {
  const seed = (email || name || "?").toLowerCase();
  const bg = AVATAR_COLORS[seedHash(seed) % AVATAR_COLORS.length];
  return (
    <span
      className="inline-grid shrink-0 place-items-center rounded-full leading-none font-semibold text-white select-none"
      style={{ width: size, height: size, background: bg, fontSize: Math.max(9, Math.round(size * 0.4)) }}
      aria-hidden
    >
      {initialsOf(name, email)}
    </span>
  );
}

function LogoMark() {
  return (
    <span
      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white"
      style={{ background: "var(--color-brand)" }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 2.5c-3.9 0-7 3-7 6.8 0 4.8 5.6 10.4 6.4 11.2.3.3.9.3 1.2 0 .8-.8 6.4-6.4 6.4-11.2 0-3.8-3.1-6.8-7-6.8Z"
          fill="currentColor"
          opacity="0.25"
        />
        <circle cx="12" cy="9.2" r="2.6" fill="currentColor" />
      </svg>
    </span>
  );
}

const NAV = [
  {
    href: "/app",
    label: "Dashboard",
    match: (p: string) => p === "/app",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3" y="3" width="7.5" height="7.5" rx="2" stroke="currentColor" strokeWidth="1.7" />
        <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" stroke="currentColor" strokeWidth="1.7" />
        <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" stroke="currentColor" strokeWidth="1.7" />
        <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    ),
  },
  {
    href: "/app/projects",
    label: "Projects",
    match: (p: string) => p.startsWith("/app/projects") || p.startsWith("/app/mockups"),
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/app/archive",
    label: "Archive",
    match: (p: string) => p.startsWith("/app/archive"),
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3" y="4" width="18" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
        <path d="M4.5 9V18a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10 13h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/app/settings",
    label: "Settings",
    match: (p: string) => p.startsWith("/app/settings"),
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export function AppSidebar({ workspaceName }: { workspaceName: string }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r bg-sidebar">
      {/* workspace */}
      <div className="p-3">
        <Link
          href="/app"
          className="flex items-center gap-3 rounded-lg border border-transparent p-2 transition-colors duration-150 hover:border-border hover:bg-canvas"
        >
          <LogoMark />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-ink">
              {workspaceName}
            </span>
            <span className="block text-[0.6875rem] font-medium tracking-wide text-faint uppercase">
              Workspace
            </span>
          </span>
        </Link>
      </div>

      {/* nav */}
      <nav className="flex-1 px-3">
        <p className="px-3 pb-1.5 pt-2 text-[0.6875rem] font-semibold tracking-wider text-faint uppercase">
          Workspace
        </p>
        <ul className="flex flex-col gap-0.5">
          {NAV.map((item) => {
            const active = item.match(pathname);
            return (
              <li key={item.href}>
                <Link href={item.href} className={active ? "nav-item-active" : "nav-item"}>
                  <span className={active ? "text-brand" : "text-faint"}>{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-3" />
    </aside>
  );
}
