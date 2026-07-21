"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import { ThemeMenu } from "./ThemeMenu";

function initials(name: string, email: string) {
  const base = (name || email || "?").trim();
  const parts = base.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

// deterministic soft tint from a string, so avatars are stable + varied
function tintHue(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}

export function Avatar({
  name,
  email,
  size = 32,
}: {
  name: string;
  email: string;
  size?: number;
}) {
  const hue = tintHue(email || name);
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: `oklch(0.93 0.05 ${hue})`,
        color: `oklch(0.42 0.13 ${hue})`,
      }}
      aria-hidden
    >
      {initials(name, email)}
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
    match: (p: string) =>
      p === "/app" || p.startsWith("/app/projects") || p.startsWith("/app/mockups"),
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
    href: "/app/members",
    label: "Team",
    match: (p: string) => p.startsWith("/app/members"),
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.7" />
        <path d="M3.5 19a5.5 5.5 0 0 1 11 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M17 19a5.5 5.5 0 0 0-2.2-4.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
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

export function AppSidebar({
  workspaceName,
  userName,
  userEmail,
}: {
  workspaceName: string;
  userName: string;
  userEmail: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r bg-sidebar">
      {/* workspace switcher */}
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
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-faint" aria-hidden>
            <path d="m8 9 4-4 4 4M8 15l4 4 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
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

      {/* theme + user */}
      <div className="border-t p-3">
        <div className="mb-1">
          <ThemeMenu />
        </div>
        <div className="flex items-center gap-2.5 rounded-lg p-1.5">
          <Avatar name={userName} email={userEmail} size={34} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-ink">
              {userName || "You"}
            </span>
            <span className="block truncate text-xs text-faint">{userEmail}</span>
          </span>
          <form action={signOut}>
            <button
              type="submit"
              title="Sign out"
              aria-label="Sign out"
              className="grid h-8 w-8 place-items-center rounded-md text-faint transition-colors duration-150 hover:bg-danger-soft hover:text-danger"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M15 12H4m0 0 3.5-3.5M4 12l3.5 3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M10 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2v-2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
