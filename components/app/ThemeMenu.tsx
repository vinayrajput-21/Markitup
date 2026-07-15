"use client";

import { useEffect, useState } from "react";

type Accent = { id: string; label: string; swatch: string };

const ACCENTS: Accent[] = [
  { id: "neutral", label: "Neutral", swatch: "#171717" },
  { id: "azure", label: "Azure", swatch: "#3056d3" },
  { id: "blue", label: "Blue", swatch: "#2563eb" },
  { id: "sky", label: "Sky", swatch: "#0ea5e9" },
  { id: "slate", label: "Slate", swatch: "#5b5bd6" },
  { id: "green", label: "Green", swatch: "#16a34a" },
  { id: "yellow", label: "Yellow", swatch: "#eab308" },
  { id: "orange", label: "Orange", swatch: "#f97316" },
  { id: "stone", label: "Stone", swatch: "#78716c" },
  { id: "rose", label: "Rose", swatch: "#e11d48" },
];

export function ThemeMenu() {
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [accent, setAccent] = useState("neutral");

  useEffect(() => {
    const el = document.documentElement;
    setDark(el.classList.contains("dark"));
    setAccent(el.getAttribute("data-theme") || "neutral");
  }, []);

  function applyMode(next: boolean) {
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("ui-mode", next ? "dark" : "light");
    setDark(next);
  }
  function applyAccent(id: string) {
    const el = document.documentElement;
    if (id === "neutral") el.removeAttribute("data-theme");
    else el.setAttribute("data-theme", id);
    localStorage.setItem("ui-accent", id);
    setAccent(id);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 rounded-lg border border-transparent p-2 text-sm font-medium text-muted transition-colors duration-150 hover:border-border hover:bg-canvas"
      >
        <span
          className="grid h-6 w-6 shrink-0 place-items-center rounded-full ring-2 ring-white/40"
          style={{ background: ACCENTS.find((a) => a.id === accent)?.swatch ?? "#171717" }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="text-white" aria-hidden>
            <path d="M12 3a9 9 0 1 0 0 18c1 0 1.5-.8 1.5-1.6 0-.5-.3-.9-.3-1.4 0-.6.5-1 1.1-1H16a5 5 0 0 0 5-5c0-4.4-4-8-9-8Z" stroke="currentColor" strokeWidth="1.6" />
            <circle cx="7.5" cy="10.5" r="1" fill="currentColor" />
            <circle cx="12" cy="7.5" r="1" fill="currentColor" />
            <circle cx="16" cy="10.5" r="1" fill="currentColor" />
          </svg>
        </span>
        <span className="flex-1 text-left">Theme</span>
        <span className="font-mono text-[0.6875rem] text-faint capitalize">{dark ? "dark" : "light"}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 z-50 mb-2 w-60 rounded-lg border bg-surface-2 p-3 shadow-lg">
            <p className="mb-1.5 text-[0.6875rem] font-semibold tracking-wider text-faint uppercase">Appearance</p>
            <div className="mb-3 inline-flex w-full rounded-md border bg-canvas p-0.5">
              {[
                { k: false, label: "Light" },
                { k: true, label: "Dark" },
              ].map((m) => (
                <button
                  key={m.label}
                  onClick={() => applyMode(m.k)}
                  className="flex-1 rounded px-2 py-1 text-xs font-semibold transition-colors duration-150"
                  style={dark === m.k ? { background: "var(--card)", color: "var(--foreground)", boxShadow: "var(--shadow-xs)" } : { color: "var(--muted-foreground)" }}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="mb-2 text-[0.6875rem] font-semibold tracking-wider text-faint uppercase">Accent</p>
            <div className="grid grid-cols-5 gap-2">
              {ACCENTS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => applyAccent(a.id)}
                  title={a.label}
                  aria-label={a.label}
                  className="grid h-8 place-items-center rounded-md transition-transform duration-150 hover:scale-105"
                  style={{
                    background: a.swatch,
                    outline: accent === a.id ? "2px solid var(--foreground)" : "none",
                    outlineOffset: "2px",
                  }}
                >
                  {accent === a.id && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-white" aria-hidden>
                      <path d="m5 12 4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
