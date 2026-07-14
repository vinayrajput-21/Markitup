"use client";

import { useState } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { toNormalized } from "@/lib/coords";
import { PinMarker } from "./PinMarker";
import { CommentThread } from "./CommentThread";
import { CommentFilter, type Filter } from "./CommentFilter";
import { createPin } from "@/app/app/mockups/[mockupId]/actions";

export type ViewerComment = {
  id: string;
  body: string;
  authorName: string;
  parentCommentId: string | null;
  createdAt: string;
};
export type ViewerPin = {
  id: string;
  x: number;
  y: number;
  number: number;
  status: "active" | "resolved";
  comments: ViewerComment[];
};

export function MockupViewer({
  mockupId,
  imageUrl,
  initialPins,
}: {
  mockupId: string;
  imageUrl: string;
  initialPins: ViewerPin[];
}) {
  const [pins, setPins] = useState<ViewerPin[]>(initialPins);
  const [activePinId, setActivePinId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  async function handleImageClick(e: React.MouseEvent<HTMLImageElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const { x, y } = toNormalized(e.clientX, e.clientY, rect);
    const res = await createPin(mockupId, x, y);
    if (res.id && res.number != null) {
      const pin: ViewerPin = { id: res.id, x, y, number: res.number, status: "active", comments: [] };
      setPins((p) => [...p, pin]);
      setActivePinId(res.id);
    }
  }

  const visiblePins = pins.filter((p) =>
    filter === "all" ? true : filter === "active" ? p.status === "active" : p.status === "resolved",
  );
  const activePin = pins.find((p) => p.id === activePinId) ?? null;

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      <div className="relative flex-1 overflow-hidden border">
        <TransformWrapper doubleClick={{ disabled: true }}>
          <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full">
            <div className="relative">
              {/* react-zoom-pan-pinch's own stylesheet sets
                  `.transform-component-module_content__FBWxo img { pointer-events: none }`
                  (to stop native image-drag from fighting its pan gesture),
                  which silently swallows every click on this image in a real
                  browser -- the click never reaches the img, so no pin can
                  ever be dropped. That CSS rule has higher specificity than a
                  Tailwind utility class, so it must be overridden inline. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt="mockup"
                onClick={handleImageClick}
                className="block w-full select-none"
                style={{ pointerEvents: "auto" }}
              />
              {visiblePins.map((p) => (
                <PinMarker key={p.id} number={p.number} x={p.x} y={p.y} status={p.status}
                  onClick={() => setActivePinId(p.id)} />
              ))}
            </div>
          </TransformComponent>
        </TransformWrapper>
      </div>
      <aside className="w-80 shrink-0 overflow-y-auto border p-3">
        <CommentFilter value={filter} onChange={setFilter} />
        {activePin ? (
          <CommentThread mockupId={mockupId} pin={activePin}
            onChange={(updated) => setPins((ps) => ps.map((p) => (p.id === updated.id ? updated : p)))} />
        ) : (
          <p className="mt-4 text-sm text-gray-500">Click the image to drop a pin, or select one.</p>
        )}
      </aside>
    </div>
  );
}
