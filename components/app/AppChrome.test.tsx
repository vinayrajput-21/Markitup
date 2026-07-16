import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const pathnameMock = vi.fn();
vi.mock("next/navigation", () => ({ usePathname: () => pathnameMock() }));
vi.mock("./AppSidebar", () => ({
  AppSidebar: () => <nav data-testid="sidebar" />,
}));

import { AppChrome } from "./AppChrome";

describe("AppChrome", () => {
  it("shows the sidebar on normal app routes", () => {
    pathnameMock.mockReturnValue("/app");
    render(<AppChrome workspaceName="W" userName="U" userEmail="e"><div /></AppChrome>);
    expect(screen.queryByTestId("sidebar")).not.toBeNull();
  });

  it("hides the sidebar on the mockup viewer route", () => {
    pathnameMock.mockReturnValue("/app/mockups/abc");
    render(<AppChrome workspaceName="W" userName="U" userEmail="e"><div /></AppChrome>);
    expect(screen.queryByTestId("sidebar")).toBeNull();
    // a reveal toggle is available instead
    expect(screen.getByRole("button", { name: /menu|sidebar/i })).toBeTruthy();
  });
});
