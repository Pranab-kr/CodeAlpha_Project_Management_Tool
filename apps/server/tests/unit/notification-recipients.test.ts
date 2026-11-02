import { describe, expect, it } from "vitest";
import {
  assignmentRecipient,
  commentRecipients,
} from "../../src/modules/notifications/notification-recipients.js";

describe("notification recipients", () => {
  it("notifies only a changed, non-self assignee", () => {
    expect(
      assignmentRecipient({
        previousAssigneeId: null,
        nextAssigneeId: "dev",
        actorId: "maya",
      }),
    ).toBe("dev");
    expect(
      assignmentRecipient({
        previousAssigneeId: "dev",
        nextAssigneeId: "dev",
        actorId: "maya",
      }),
    ).toBeNull();
    expect(
      assignmentRecipient({
        previousAssigneeId: "sam",
        nextAssigneeId: "dev",
        actorId: "dev",
      }),
    ).toBeNull();
    expect(
      assignmentRecipient({
        previousAssigneeId: "dev",
        nextAssigneeId: null,
        actorId: "maya",
      }),
    ).toBeNull();
  });

  it("dedupes comment recipients and excludes the actor", () => {
    expect(
      commentRecipients({
        assigneeId: "dev",
        createdById: "maya",
        actorId: "sam",
      }),
    ).toEqual(["dev", "maya"]);
    expect(
      commentRecipients({
        assigneeId: "dev",
        createdById: "dev",
        actorId: "maya",
      }),
    ).toEqual(["dev"]);
    expect(
      commentRecipients({
        assigneeId: "maya",
        createdById: "maya",
        actorId: "maya",
      }),
    ).toEqual([]);
    expect(
      commentRecipients({
        assigneeId: null,
        createdById: null,
        actorId: "maya",
      }),
    ).toEqual([]);
  });
});
