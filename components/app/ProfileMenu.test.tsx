import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/app/auth/actions", () => ({ signOut: vi.fn() }));

import { ProfileMenu } from "./ProfileMenu";

describe("ProfileMenu", () => {
  it("opens a menu with Your Profile and Sign out", () => {
    render(<ProfileMenu name="Ravi Rajput" email="ravi@x.com" />);
    // menu hidden initially
    expect(screen.queryByText("Sign out")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /account menu/i }));
    expect(screen.getByText("Your Profile")).toBeTruthy();
    expect(screen.getByText("Sign out")).toBeTruthy();
  });
});
