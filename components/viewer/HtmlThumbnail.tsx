"use client";

import { useEffect, useRef, useState } from "react";

// A live, scaled-down preview of an uploaded HTML page for card covers.
// Renders the top of the page in a fully sandboxed iframe (scripts OFF — CSS and
// layout only, so it stays light even with many previews on a grid) scaled to
// fit the card width. The page is fetched as text and shown via srcdoc because
// storage serves .html as text/plain.
const DESIGN_W = 1280;

export function HtmlThumbnail({ url, className = "" }: { url: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<string | null>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    let alive = true;
    fetch(url)
      .then((r) => r.text())
      .then((t) => { if (alive) setDoc(t); })
      .catch(() => {});
    return () => { alive = false; };
  }, [url]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / DESIGN_W);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const ready = !!doc && scale > 0;
  return (
    <div ref={ref} className={`relative overflow-hidden bg-white ${className}`}>
      {!ready && <div className="skeleton absolute inset-0 !rounded-none" />}
      {ready && (
        <iframe
          srcDoc={doc}
          title="HTML preview"
          sandbox=""
          scrolling="no"
          tabIndex={-1}
          aria-hidden
          className="media-in"
          style={{
            width: DESIGN_W,
            height: DESIGN_W,
            border: 0,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}
