import type { ProjectMember } from "@teamboard/shared";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PresenceStack from "./PresenceStack";

function member(id: string, name: string, initials: string): ProjectMember {
  return {
    userId: id,
    email: `${id}@teamboard.dev`,
    name,
    initials,
    role: "member",
    joinedAt: "2026-11-01T10:00:00.000Z",
  };
}

const members = [
  member("u1", "Maya Chen", "MC"),
  member("u2", "Dev Patel", "DP"),
  member("u3", "Sam Rivera", "SR"),
  member("u4", "Ava Stone", "AS"),
  member("u5", "Leo Park", "LP"),
  member("u6", "Nina Ortiz", "NO"),
];

describe("PresenceStack", () => {
  it("shows online members with accessible labels", () => {
    render(
      <PresenceStack
        members={members}
        onlineUserIds={["u1", "u2", "u3", "u4"]}
      />,
    );

    expect(screen.getByLabelText("Maya Chen is online")).toBeInTheDocument();
    expect(screen.getByLabelText("Dev Patel is online")).toBeInTheDocument();
    expect(screen.getByLabelText("4 online")).toBeInTheDocument();
  });

  it("does not render offline members", () => {
    render(<PresenceStack members={members} onlineUserIds={["u1", "u2"]} />);

    expect(
      screen.queryByLabelText("Nina Ortiz is online"),
    ).not.toBeInTheDocument();
  });

  it("summarizes more than four online members with +N", () => {
    render(
      <PresenceStack
        members={members}
        onlineUserIds={["u1", "u2", "u3", "u4", "u5"]}
      />,
    );

    expect(screen.getByText("+1")).toBeInTheDocument();
    expect(screen.getByLabelText("1 more online")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Leo Park is online"),
    ).not.toBeInTheDocument();
  });

  it("renders nothing when nobody is online", () => {
    render(<PresenceStack members={members} onlineUserIds={[]} />);

    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });
});
