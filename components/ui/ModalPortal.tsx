"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Render modal content at the document root so `position: fixed` is relative to
// the viewport — not trapped/clipped by an ancestor card's transform/overflow.
export function ModalPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
