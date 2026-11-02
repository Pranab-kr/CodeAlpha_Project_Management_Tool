import type { ProjectDetail, ProjectMember } from "@teamboard/shared";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../../components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "../../components/ui/avatar";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { ApiError } from "../../lib/api";
import { initialsColor } from "../../lib/format";
import { useAuth } from "../auth/useAuth";
import AddMemberDialog from "./AddMemberDialog";
import { useRemoveMember, useUpdateMemberRole } from "./useProjects";

const ROLE_ITEMS = [
  { value: "admin", label: "Admin" },
  { value: "member", label: "Member" },
];

function errorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "Something went wrong. Please try again.";
}

function RemoveMemberDialog({
  member,
  isSelf,
  pending,
  onConfirm,
}: {
  member: ProjectMember;
  isSelf: boolean;
  pending: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            aria-label={isSelf ? "Leave project" : `Remove ${member.name}`}
          />
        }
      >
        {isSelf ? "Leave project" : "Remove"}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isSelf ? "Leave this project?" : `Remove ${member.name}?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isSelf
              ? "You will lose access to the board. Your assigned tasks will be unassigned."
              : "They will lose access immediately and their assigned tasks in this project will be unassigned."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={pending}>
            {isSelf ? "Leave project" : "Remove member"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default function MembersPanel({ project }: { project: ProjectDetail }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const roleMutation = useUpdateMemberRole(project.id);
  const removeMutation = useRemoveMember(project.id);

  const isOwner = project.role === "owner";
  const isManager = isOwner || project.role === "admin";

  const handleRoleChange = (member: ProjectMember, role: string | null) => {
    if (role !== "admin" && role !== "member") return;
    void roleMutation
      .mutateAsync({ userId: member.userId, input: { role } })
      .then(() => toast.success("Role updated"))
      .catch((error) => toast.error(errorMessage(error)));
  };

  const handleRemove = (member: ProjectMember) => {
    const isSelf = member.userId === user?.id;
    void removeMutation
      .mutateAsync(member.userId)
      .then(() => {
        if (isSelf) {
          toast.success("You left the project");
          navigate("/projects");
          return;
        }
        toast.success(`${member.name} removed from the project`);
      })
      .catch((error) => toast.error(errorMessage(error)));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-base font-medium">Members</h2>
          <p className="text-sm text-muted-foreground">
            {project.memberCount}{" "}
            {project.memberCount === 1 ? "person" : "people"} in this project.
          </p>
        </div>
        {isManager ? <AddMemberDialog projectId={project.id} /> : null}
      </div>

      <ul className="divide-y rounded-xl border bg-card">
        {project.members.map((member) => {
          const isSelf = member.userId === user?.id;
          const canChangeRole = isOwner && member.role !== "owner";
          const canRemove =
            member.role !== "owner" &&
            (isSelf ||
              isOwner ||
              (project.role === "admin" && member.role !== "admin"));

          return (
            <li
              key={member.userId}
              className="flex flex-wrap items-center gap-3 p-4"
            >
              <Avatar>
                <AvatarFallback className={initialsColor(member.userId)}>
                  {member.initials}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {member.name}
                  {isSelf ? (
                    <span className="ml-1 text-muted-foreground">(you)</span>
                  ) : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {member.email}
                </p>
              </div>

              {canChangeRole ? (
                <Select
                  items={ROLE_ITEMS}
                  value={member.role}
                  onValueChange={(role) => handleRoleChange(member, role)}
                >
                  <SelectTrigger
                    size="sm"
                    aria-label={`Role for ${member.name}`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_ITEMS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Badge variant="secondary">{member.role}</Badge>
              )}

              <span className="text-xs text-muted-foreground">
                Joined {new Date(member.joinedAt).toLocaleDateString()}
              </span>

              {canRemove ? (
                <RemoveMemberDialog
                  member={member}
                  isSelf={isSelf}
                  pending={removeMutation.isPending}
                  onConfirm={() => handleRemove(member)}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
