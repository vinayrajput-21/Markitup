// Small, dependency-free confetti burst. Subtle by default: one short burst of
// color-filled paper, respects prefers-reduced-motion, and cleans up its canvas.
export function celebrate(originX?: number, originY?: number, count = 90) {
  if (typeof window === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  const canvas = document.createElement("canvas");
  canvas.style.cssText =
    "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999";
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  document.body.appendChild(canvas);

  const colors = ["#6366f1", "#22c55e", "#f59e0b", "#ec4899", "#0ea5e9", "#a855f7"];
  const ox = originX ?? window.innerWidth / 2;
  const oy = originY ?? window.innerHeight / 3;
  const N = count;

  type P = {
    x: number; y: number; vx: number; vy: number; size: number;
    color: string; rot: number; vr: number; round: boolean;
  };
  const parts: P[] = Array.from({ length: N }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 3 + Math.random() * 7;
    return {
      x: ox, y: oy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 4,
      size: 5 + Math.random() * 6,
      color: colors[(Math.random() * colors.length) | 0],
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      round: Math.random() < 0.4,
    };
  });

  const gravity = 0.18;
  const drag = 0.99;
  const start = performance.now();
  const DURATION = 1900;
  let raf = 0;

  function frame(t: number) {
    const elapsed = t - start;
    const life = Math.max(0, 1 - elapsed / DURATION);
    ctx!.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (const p of parts) {
      p.vx *= drag;
      p.vy = p.vy * drag + gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx!.save();
      ctx!.translate(p.x, p.y);
      ctx!.rotate(p.rot);
      ctx!.globalAlpha = life;
      ctx!.fillStyle = p.color;
      if (p.round) {
        ctx!.beginPath();
        ctx!.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx!.fill();
      } else {
        ctx!.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      }
      ctx!.restore();
    }
    if (elapsed < DURATION + 300) {
      raf = requestAnimationFrame(frame);
    } else {
      cancelAnimationFrame(raf);
      canvas.remove();
    }
  }
  raf = requestAnimationFrame(frame);
}
