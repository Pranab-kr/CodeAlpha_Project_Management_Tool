import { getMembership } from "../modules/projects/projects.permissions.js";
import { getOnlineUserIds, addPresence, removePresence } from "./presence.js";
import { projectRoom } from "./rooms.js";
import { joinProjectSchema } from "./schemas.js";
import type { AppServer, AppSocket } from "./types.js";

function broadcastPresence(io: AppServer, projectId: string): void {
  io.to(projectRoom(projectId)).emit("presence:update", {
    projectId,
    onlineUserIds: getOnlineUserIds(projectId),
  });
}

export function registerHandlers(io: AppServer, socket: AppSocket): void {
  socket.on("project:join", async (payload, ack) => {
    const parsed = joinProjectSchema.safeParse(payload);
    if (!parsed.success) {
      ack({ ok: false, code: "INVALID_PAYLOAD" });
      return;
    }
    const { projectId } = parsed.data;

    const membership = await getMembership(projectId, socket.data.user.id);
    if (!membership) {
      ack({ ok: false, code: "NOT_FOUND" });
      return;
    }

    await socket.join(projectRoom(projectId));
    socket.data.joinedProjects.add(projectId);
    addPresence(projectId, socket.data.user.id, socket.id);

    ack({ ok: true, onlineUserIds: getOnlineUserIds(projectId) });
    broadcastPresence(io, projectId);
  });

  socket.on("project:leave", (payload, ack) => {
    const parsed = joinProjectSchema.safeParse(payload);
    if (!parsed.success) {
      ack?.({ ok: true });
      return;
    }
    const { projectId } = parsed.data;
    void socket.leave(projectRoom(projectId));
    socket.data.joinedProjects.delete(projectId);
    removePresence(projectId, socket.data.user.id, socket.id);
    ack?.({ ok: true });
    broadcastPresence(io, projectId);
  });

  socket.on("disconnect", () => {
    for (const projectId of socket.data.joinedProjects) {
      removePresence(projectId, socket.data.user.id, socket.id);
      broadcastPresence(io, projectId);
    }
    socket.data.joinedProjects.clear();
  });
}
