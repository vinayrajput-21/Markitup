"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

// Dependency-free nprogress-style top bar. Starts on internal link clicks /
// history navigation and completes when the pathname changes.
export function TopProgress() {
  const pathname = usePathname();
  const [value, setValue] = useState(0);
  const [active, setActive] = useState(false);
  const trickle = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(false);

  useEffect(() => { activeRef.current = active; }, [active]);

  useEffect(() => {
    function start() {
      if (activeRef.current) return;
      activeRef.current = true;
      setActive(true);
      setValue(8);
      trickle.current = setInterval(() => {
        setValue((v) => (v < 90 ? v + (90 - v) * 0.12 : v));
      }, 200);
    }
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      if (!a) return;
      const href = a.getAttribute("href");
      const target = a.getAttribute("target");
      if (!href || href.startsWith("#") || target === "_blank" || a.hasAttribute("download")) return;
      try {
        const url = new URL(href, location.href);
        if (url.origin !== location.origin) return;
        if (url.pathname === location.pathname) return; // same page (e.g. query-only)
      } catch {
        return;
      }
      start();
    }
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", start);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", start);
    };
  }, []);

  // complete when the route actually changes
  useEffect(() => {
    if (!activeRef.current) return;
    if (trickle.current) clearInterval(trickle.current);
    setValue(100);
    hideTimer.current = setTimeout(() => {
      activeRef.current = false;
      setActive(false);
      setValue(0);
    }, 260);
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [pathname]);

  return (
    <div className="top-progress-wrap" aria-hidden style={{ opacity: active ? 1 : 0 }}>
      <div className="top-progress" style={{ width: `${value}%` }} />
    </div>
  );
}
