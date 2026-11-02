import type { ProjectListItem } from "@teamboard/shared";
import { Link } from "react-router-dom";
import { Avatar, AvatarFallback } from "../../components/ui/avatar";
import { Badge } from "../../components/ui/badge";
import { formatRelativeTime, initialsColor } from "../../lib/format";

export default function ProjectCard({ project }: { project: ProjectListItem }) {
  return (
    <Link
      to={`/projects/${project.id}`}
      className="group flex h-full flex-col rounded-xl border bg-card p-5 transition-shadow hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-heading text-base font-medium group-hover:underline">
          {project.name}
        </h3>
        <Badge variant="secondary">{project.role}</Badge>
      </div>

      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
        {project.description || "No description yet."}
      </p>

      <div className="mt-auto flex items-center justify-between gap-3 pt-5">
        <div className="flex -space-x-2" aria-label="Project members">
          {project.members.slice(0, 4).map((member) => (
            <Avatar key={member.id} size="sm" className="ring-2 ring-card">
              <AvatarFallback className={initialsColor(member.id)}>
                {member.initials}
              </AvatarFallback>
            </Avatar>
          ))}
          {project.memberCount > 4 ? (
            <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground ring-2 ring-card">
              +{project.memberCount - 4}
            </span>
          ) : null}
        </div>
        <span className="text-xs text-muted-foreground">
          {project.taskCount} {project.taskCount === 1 ? "task" : "tasks"}
        </span>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Updated {formatRelativeTime(project.updatedAt)}
      </p>
    </Link>
  );
}
