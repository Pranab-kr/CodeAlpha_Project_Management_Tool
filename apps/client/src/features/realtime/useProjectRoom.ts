import { useEffect, useState } from "react";
import { useSocket } from "./useSocket";

/** Joins the project room on mount and after reconnects; leaves on unmount. */
export function useProjectRoom(projectId: string | undefined): {
  onlineUserIds: string[];
} {
  const { socket } = useSocket();
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);

  useEffect(() => {
    if (!projectId) return;
    setOnlineUserIds([]);

    const join = () => {
      socket.emit("project:join", { projectId }, (response) => {
        if (response.ok) setOnlineUserIds(response.onlineUserIds);
      });
    };
    const onConnect = () => join();
    const onPresence = (payload: {
      projectId: string;
      onlineUserIds: string[];
    }) => {
      if (payload.projectId === projectId) {
        setOnlineUserIds(payload.onlineUserIds);
      }
    };

    socket.on("connect", onConnect);
    socket.on("presence:update", onPresence);
    if (socket.connected) {
      join();
    } else {
      socket.connect();
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("presence:update", onPresence);
      socket.emit("project:leave", { projectId });
    };
  }, [socket, projectId]);

  return { onlineUserIds };
}
