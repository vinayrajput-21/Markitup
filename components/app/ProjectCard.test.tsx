import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProjectCard } from "./ProjectCard";

describe("ProjectCard", () => {
  it("shows the name and the three counts", () => {
    render(
      <ProjectCard
        id="p1"
        name="Homepage"
        coverUrl={undefined}
        updatedAt={new Date().toISOString()}
        stats={{ mockups: 3, comments: 5, resolved: 2 }}
      />,
    );
    expect(screen.getByText("Homepage")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();   // mockups
    expect(screen.getByText("5")).toBeTruthy();   // comments
    expect(screen.getByText("2")).toBeTruthy();   // resolved
  });
});
