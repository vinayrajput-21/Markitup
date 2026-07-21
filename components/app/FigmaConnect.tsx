"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setFigmaToken, disconnectFigma } from "@/app/app/figma-actions";

export function FigmaConnect({ connected }: { connected: boolean }) {
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function connect() {
    if (!token.trim()) return;
    setError(null);
    start(async () => {
      const r = await setFigmaToken(token);
      if (r?.error) setError(r.error);
      else {
        setToken("");
        router.refresh();
      }
    });
  }
  function disconnect() {
    start(async () => {
      await disconnectFigma();
      router.refresh();
    });
  }

  return (
    <div className="card max-w-2xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-canvas ring-1 ring-border">
            <svg width="18" height="26" viewBox="0 0 38 57" aria-hidden>
              <path d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0Z" fill="#1abcfe" />
              <path d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0Z" fill="#0acf83" />
              <path d="M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19Z" fill="#ff7262" />
              <path d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5Z" fill="#f24e1e" />
              <path d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5Z" fill="#a259ff" />
            </svg>
          </span>
          <div>
            <h3 className="font-semibold text-ink">Figma</h3>
            <p className="text-sm text-muted">Import prototype frames as reviewable mockups.</p>
          </div>
        </div>
        {connected && (
          <span className="chip" style={{ background: "var(--success-soft)", color: "var(--success)" }}>
            Connected
          </span>
        )}
      </div>

      <div className="mt-4">
        <label htmlFor="figma-token" className="field-label">
          Figma personal access token
        </label>
        <div className="flex gap-2">
          <input
            id="figma-token"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={connected ? "Paste a new token to replace…" : "figd_…"}
            className="field flex-1"
          />
          <button onClick={connect} disabled={pending || !token.trim()} className="btn-primary">
            {connected ? "Update" : "Connect"}
          </button>
          {connected && (
            <button onClick={disconnect} disabled={pending} className="btn-secondary">
              Disconnect
            </button>
          )}
        </div>
        {error && (
          <p className="mt-2 text-sm font-medium" style={{ color: "var(--destructive)" }}>{error}</p>
        )}
        <p className="mt-2 text-xs text-faint">
          Create one in Figma → Settings → Security → Personal access tokens. Stored
          encrypted; only workspace owners/admins can set it.
        </p>
      </div>
    </div>
  );
}
