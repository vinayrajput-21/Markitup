"use client";

import { useState } from "react";
import { Avatar } from "@/components/app/AppSidebar";
import type { TeamData, TeamMember, TeamGuest } from "@/app/app/team-actions";

type TabKey = "admins" | "managers" | "guests";

function RoleChip({ kind }: { kind: "Owner" | "Admin" | "Manager" | "Guest" }) {
  const style =
    kind === "Admin" || kind === "Owner"
      ? { background: "var(--color-brand-soft)", color: "var(--color-brand-ink)" }
      : kind === "Manager"
        ? { background: "var(--color-canvas)", color: "var(--color-ink)" }
        : { background: "var(--color-canvas)", color: "var(--color-muted)" };
  return <span className="chip" style={style}>{kind}</span>;
}

function PendingChip() {
  return (
    <span className="chip" style={{ background: "var(--color-warning-soft, var(--color-canvas))", color: "var(--color-warning, var(--color-muted))" }}>
      Pending
    </span>
  );
}

const ROW_GRID = "grid grid-cols-[1fr_auto] items-center gap-4 px-4 py-3 sm:grid-cols-[1.4fr_1fr_auto]";

function MemberRow({ m }: { m: TeamMember }) {
  const kind = m.role === "owner" ? "Owner" : m.role === "admin" ? "Admin" : "Manager";
  return (
    <div className={ROW_GRID}>
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={m.name} email={m.email} size={34} />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-ink">
            {m.name}
            {m.isYou && <span className="ml-1.5 font-normal text-faint">(you)</span>}
          </div>
          <div className="truncate text-xs text-faint sm:hidden">{m.email}</div>
        </div>
      </div>
      <div className="hidden min-w-0 truncate text-sm text-muted sm:block">{m.email}</div>
      <div className="justify-self-end">{m.pending ? <PendingChip /> : <RoleChip kind={kind} />}</div>
    </div>
  );
}

function GuestRow({ g }: { g: TeamGuest }) {
  return (
    <div className={ROW_GRID}>
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={g.name} email={g.email} size={34} />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-ink">{g.name}</div>
          <div className="truncate text-xs text-faint sm:hidden">{g.email}</div>
        </div>
      </div>
      <div className="hidden min-w-0 truncate text-sm text-muted sm:block">{g.email}</div>
      <div className="justify-self-end">{g.pending ? <PendingChip /> : <RoleChip kind="Guest" />}</div>
    </div>
  );
}

export function TeamRoster({ data }: { data: TeamData }) {
  const [tab, setTab] = useState<TabKey>("admins");
  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: "admins", label: "Admin", count: data.admins.length },
    { key: "managers", label: "Manager", count: data.managers.length },
    { key: "guests", label: "Guests", count: data.guests.length },
  ];

  const empty =
    (tab === "admins" && data.admins.length === 0) ||
    (tab === "managers" && data.managers.length === 0) ||
    (tab === "guests" && data.guests.length === 0);

  return (
    <div className="card overflow-hidden">
      {/* Role tabs */}
      <div className="flex gap-6 border-b px-4">
        {tabs.map((t) => {
          const on = t.key === tab;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="relative -mb-px py-3 text-sm font-semibold transition-colors"
              style={{ color: on ? "var(--color-ink)" : "var(--color-muted)" }}
            >
              {t.label} <span className="text-faint">{t.count}</span>
              {on && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full" style={{ background: "var(--color-brand)" }} />}
            </button>
          );
        })}
      </div>

      {/* Column header */}
      <div className="grid grid-cols-[1fr_auto] items-center gap-4 border-b bg-surface px-4 py-2.5 text-xs font-semibold tracking-wider text-faint uppercase sm:grid-cols-[1.4fr_1fr_auto]">
        <span>Name</span>
        <span className="hidden sm:block">Email</span>
        <span>Role</span>
      </div>

      {empty ? (
        <p className="px-4 py-10 text-center text-sm text-faint">
          {tab === "guests"
            ? "No guests yet. Share a project or file with a client to add one."
            : tab === "managers"
              ? "No managers yet. Invite a teammate as a Manager."
              : "No admins yet."}
        </p>
      ) : (
        <div className="divide-y">
          {tab === "admins" && data.admins.map((m) => <MemberRow key={m.id} m={m} />)}
          {tab === "managers" && data.managers.map((m) => <MemberRow key={m.id} m={m} />)}
          {tab === "guests" && data.guests.map((g) => <GuestRow key={g.email} g={g} />)}
        </div>
      )}
    </div>
  );
}
