import type { ServerToClientEvents } from "@teamboard/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { queryKeys } from "../../lib/query-keys";
import { useAuth } from "../auth/useAuth";
import { notificationCopy } from "../notifications/notification-copy";
import { invalidateForEvent } from "./query-invalidation";
import { useSocket } from "./useSocket";

const INVALIDATED_EVENTS = [
  "task:created",
  "task:updated",
  "task:moved",
  "task:deleted",
  "column:created",
  "column:updated",
  "column:deleted",
  "columns:reordered",
  "comment:created",
  "comment:updated",
  "comment:deleted",
  "project:updated",
  "project:deleted",
  "member:added",
  "member:updated",
  "member:removed",
] as const satisfies readonly (keyof ServerToClientEvents)[];

export function useRealtimeSync(): void {
  const { socket } = useSocket();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const location = useLocation();
  const pathnameRef = useRef(location.pathname);
  const userId = user?.id;

  useEffect(() => {
    pathnameRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    type Handler = (payload: never) => void;
    const handlers: [string, Handler][] = [];

    const register = <K extends keyof ServerToClientEvents>(
      event: K,
      handler: (payload: Parameters<ServerToClientEvents[K]>[0]) => void,
    ) => {
      socket.on(event, handler as never);
      handlers.push([event, handler as Handler]);
    };

    for (const event of INVALIDATED_EVENTS) {
      register(event, (payload) => {
        invalidateForEvent(queryClient, event, payload);
      });
    }

    const teardown = (projectId: string) => {
      queryClient.removeQueries({ queryKey: queryKeys.project(projectId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      if (pathnameRef.current.startsWith(`/projects/${projectId}`)) {
        navigate("/projects");
      }
    };

    register("project:deleted", ({ projectId }) => {
      teardown(projectId);
      toast("This project is no longer available");
    });

    register("member:removed", ({ projectId, userId: removedUserId }) => {
      if (removedUserId === userId) {
        teardown(projectId);
        toast("This project is no longer available");
      }
    });

    register("notification:new", ({ notification }) => {
      queryClient.setQueryData<{ count: number }>(
        queryKeys.notificationUnreadCount,
        (current) => ({
          count: Math.min(999, (current?.count ?? 0) + 1),
        }),
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.notificationList(),
      });
      toast(notificationCopy(notification));
    });

    // A read event is authoritative from refetch: the acting tab's mutation
    // already updated the cache, so decrementing again would drift.
    register("notification:read", () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.notificationUnreadCount,
      });
    });

    register("notifications:read-all", () => {
      queryClient.setQueryData<{ count: number }>(
        queryKeys.notificationUnreadCount,
        { count: 0 },
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
    });

    const onConnect = () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.notifications,
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.notificationUnreadCount,
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    };
    socket.on("connect", onConnect);

    return () => {
      for (const [event, handler] of handlers) {
        socket.off(event as never, handler as never);
      }
      socket.off("connect", onConnect);
    };
  }, [socket, queryClient, navigate, userId]);
}
