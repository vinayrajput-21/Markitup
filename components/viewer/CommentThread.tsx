"use client";
import type { ViewerPin } from "./MockupViewer";
export function CommentThread({ pin }: { mockupId: string; pin: ViewerPin; onChange: (p: ViewerPin) => void }) {
  return <div className="mt-2 text-sm">Pin #{pin.number}</div>;
}
