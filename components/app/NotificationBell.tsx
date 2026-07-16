"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getNotifications, markNotificationsRead, type NotificationItem } from "@/app/app/notifications-actions";
import { timeAgo } from "@/lib/format";

export function NotificationBell() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    const res = await getNotifications();
    setItems(res.items);
    setUnread(res.unreadCount);
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 30000);
    return () => clearInterval(t);
  }, [refresh]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      setUnread(0);
      await markNotificationsRead();
      setItems((prev) => prev.map((i) => ({ ...i, readAt: i.readAt ?? new Date().toISOString() })));
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Notifications"
        onClick={toggle}
        className="relative grid h-9 w-9 place-items-center rounded-full text-muted transition-colors hover:bg-[color:var(--accent)] hover:text-ink"
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          <path d="M10 20a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
        {unread > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[0.625rem] font-bold text-white"
            style={{ background: "var(--color-danger)" }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-lg border bg-surface-2 shadow-lg">
            <div className="border-b px-3 py-2.5 text-sm font-semibold text-ink">Notifications</div>
            <div className="max-h-96 divide-y overflow-y-auto">
              {items.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-faint">You're all caught up.</p>
              ) : (
                items.map((n) => {
                  const inner = (
                    <div className="flex flex-col gap-0.5 px-3 py-2.5 transition-colors hover:bg-[color:var(--accent)]">
                      <span className="text-sm text-ink">{n.body}</span>
                      <span className="font-mono text-[0.6875rem] text-faint">{timeAgo(n.createdAt)}</span>
                    </div>
                  );
                  return n.mockupId ? (
                    <Link key={n.id} href={`/app/mockups/${n.mockupId}`} onClick={() => setOpen(false)} className="block">
                      {inner}
                    </Link>
                  ) : (
                    <div key={n.id}>{inner}</div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
