import type { ProjectMember } from "@teamboard/shared";
import { Avatar, AvatarFallback } from "../../components/ui/avatar";
import { initialsColor } from "../../lib/format";

const MAX_VISIBLE = 4;

export default function PresenceStack({
  members,
  onlineUserIds,
}: {
  members: ProjectMember[];
  onlineUserIds: string[];
}) {
  const online = new Set(onlineUserIds);
  const onlineMembers = members.filter((member) => online.has(member.userId));
  if (onlineMembers.length === 0) return null;

  const visible = onlineMembers.slice(0, MAX_VISIBLE);
  const extra = onlineMembers.length - visible.length;

  return (
    <div
      className="flex items-center -space-x-2"
      role="group"
      aria-label={`${onlineMembers.length} online`}
    >
      {visible.map((member) => (
        <span
          key={member.userId}
          className="relative"
          role="img"
          aria-label={`${member.name} is online`}
          title={`${member.name} is online`}
        >
          <Avatar size="sm" className="ring-2 ring-background">
            <AvatarFallback className={initialsColor(member.userId)}>
              {member.initials}
            </AvatarFallback>
          </Avatar>
          <span
            aria-hidden="true"
            className="absolute right-0 bottom-0 size-2 rounded-full bg-emerald-500 ring-2 ring-background"
          />
        </span>
      ))}
      {extra > 0 ? (
        <span
          className="flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground ring-2 ring-background"
          aria-label={`${extra} more online`}
        >
          +{extra}
        </span>
      ) : null}
    </div>
  );
}
