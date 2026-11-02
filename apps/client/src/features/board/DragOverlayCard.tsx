import type { TaskCard } from "@teamboard/shared";
import { Badge } from "../../components/ui/badge";

export default function DragOverlayCard({ task }: { task: TaskCard }) {
  return (
    <div className="w-80 rotate-1 rounded-lg border bg-card p-3 text-left shadow-xl">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium break-words">{task.title}</p>
        <Badge variant="secondary" className="capitalize">
          {task.priority}
        </Badge>
      </div>
    </div>
  );
}
