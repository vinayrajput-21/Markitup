"use client";

export function PinMarker({
  number,
  x,
  y,
  status,
  onClick,
}: {
  number: number;
  x: number;
  y: number;
  status: "active" | "resolved";
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
      className={`absolute -translate-x-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full text-xs text-white ${
        status === "resolved" ? "bg-green-600" : "bg-blue-600"
      }`}
    >
      {number}
    </button>
  );
}
