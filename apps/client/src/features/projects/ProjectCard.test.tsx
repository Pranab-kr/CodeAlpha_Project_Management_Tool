import type { ProjectListItem } from "@teamboard/shared";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ProjectCard from "./ProjectCard";
import { renderWithProviders } from "../../test/render";

const project: ProjectListItem = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Website Redesign",
  description: "Refresh the marketing site end to end",
  ownerId: "22222222-2222-4222-8222-222222222222",
  role: "owner",
  memberCount: 3,
  taskCount: 3,
  members: [
    {
      id: "u1",
      email: "maya@teamboard.dev",
      name: "Maya Chen",
      initials: "MC",
    },
    {
      id: "u2",
      email: "dev@teamboard.dev",
      name: "Dev Patel",
      initials: "DP",
    },
    {
      id: "u3",
      email: "sam@teamboard.dev",
      name: "Sam Rivera",
      initials: "SR",
    },
  ],
  createdAt: "2026-11-01T10:00:00.000Z",
  updatedAt: "2026-11-02T10:00:00.000Z",
};

describe("ProjectCard", () => {
  it("renders the name, excerpt, role, task count, and member initials", () => {
    renderWithProviders(<ProjectCard project={project} />);

    expect(screen.getByText("Website Redesign")).toBeInTheDocument();
    expect(
      screen.getByText("Refresh the marketing site end to end"),
    ).toBeInTheDocument();
    expect(screen.getByText("owner")).toBeInTheDocument();
    expect(screen.getByText("3 tasks")).toBeInTheDocument();
    expect(screen.getByText("MC")).toBeInTheDocument();
    expect(screen.getByText("DP")).toBeInTheDocument();
    expect(screen.getByText("SR")).toBeInTheDocument();
  });

  it("links to the project board", () => {
    renderWithProviders(<ProjectCard project={project} />);
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      `/projects/${project.id}`,
    );
  });

  it("renders a placeholder when the description is empty", () => {
    renderWithProviders(
      <ProjectCard project={{ ...project, description: "" }} />,
    );
    expect(screen.getByText("No description yet.")).toBeInTheDocument();
  });
});
