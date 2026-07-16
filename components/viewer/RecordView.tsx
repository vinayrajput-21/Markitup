"use client";

import { useEffect } from "react";
import { recordMockupView } from "@/app/app/mockups/[mockupId]/view-actions";

export function RecordView({ mockupId }: { mockupId: string }) {
  useEffect(() => {
    recordMockupView(mockupId);
  }, [mockupId]);
  return null;
}
