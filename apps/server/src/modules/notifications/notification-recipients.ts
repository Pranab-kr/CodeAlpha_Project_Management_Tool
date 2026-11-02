export interface AssignmentRecipientInput {
  previousAssigneeId: string | null;
  nextAssigneeId: string | null;
  actorId: string;
}

/** The new assignee, only when it actually changed and is not the actor. */
export function assignmentRecipient(
  input: AssignmentRecipientInput,
): string | null {
  const { previousAssigneeId, nextAssigneeId, actorId } = input;
  if (!nextAssigneeId) return null;
  if (nextAssigneeId === previousAssigneeId) return null;
  if (nextAssigneeId === actorId) return null;
  return nextAssigneeId;
}

export interface CommentRecipientInput {
  assigneeId: string | null;
  createdById: string | null;
  actorId: string;
}

/**
 * Assignee then creator, deduplicated, with the commenter removed. Order is
 * preserved so notification rows are created deterministically.
 */
export function commentRecipients(input: CommentRecipientInput): string[] {
  const candidates = [input.assigneeId, input.createdById].filter(
    (id): id is string => Boolean(id) && id !== input.actorId,
  );
  return [...new Set(candidates)];
}
