const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function toNormalized(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
) {
  return {
    x: clamp01((clientX - rect.left) / rect.width),
    y: clamp01((clientY - rect.top) / rect.height),
  };
}

export function toPixels(
  x: number,
  y: number,
  size: { width: number; height: number },
) {
  return { left: x * size.width, top: y * size.height };
}
