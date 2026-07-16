import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

vi.mock("@/components/app/AppSidebar", () => ({
  Avatar: ({ name }: { name: string }) => <span>{name[0]}</span>,
}));

import { RecentViewers } from "./RecentViewers";

const viewers = [
  { id: "u1", name: "Ravi Rajput", email: "ravi@x.com", viewedAt: new Date().toISOString() },
  { id: "u2", name: "Dr Mira Saric", email: "mira@x.com", viewedAt: new Date(Date.now() - 3600_000).toISOString() },
];

describe("RecentViewers", () => {
  it("renders nothing when there are no viewers", () => {
    const { container } = render(<RecentViewers viewers={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lists viewers with names in the dropdown", () => {
    render(<RecentViewers viewers={viewers} />);
    fireEvent.click(screen.getByRole("button", { name: /viewed by/i }));
    expect(screen.getByText("Ravi Rajput")).toBeTruthy();
    expect(screen.getByText("Dr Mira Saric")).toBeTruthy();
    expect(screen.getByText(/Recently viewed by/i)).toBeTruthy();
  });
});
