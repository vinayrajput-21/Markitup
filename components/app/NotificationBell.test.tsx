import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

const { getNotifications, markNotificationsRead } = vi.hoisted(() => ({
  getNotifications: vi.fn().mockResolvedValue({
    items: [
      { id: "n1", type: "comment", body: "Jane commented on Home", mockupId: "m1", readAt: null, createdAt: new Date().toISOString(), actorName: "Jane" },
    ],
    unreadCount: 1,
  }),
  markNotificationsRead: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/app/app/notifications-actions", () => ({ getNotifications, markNotificationsRead }));

import { NotificationBell } from "./NotificationBell";

describe("NotificationBell", () => {
  it("shows an unread badge and the notification on open", async () => {
    render(<NotificationBell />);
    await waitFor(() => expect(screen.getByText("1")).toBeTruthy()); // unread badge
    fireEvent.click(screen.getByRole("button", { name: /notifications/i }));
    expect(screen.getByText(/Jane commented on Home/)).toBeTruthy();
    await waitFor(() => expect(markNotificationsRead).toHaveBeenCalled());
  });
});
