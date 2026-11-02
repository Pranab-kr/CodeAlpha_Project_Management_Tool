import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { refreshSession } from "../../lib/api";
import { appSocket } from "../../lib/socket";
import { useAuth } from "../auth/useAuth";
import { SocketContext } from "./useSocket";
import { useRealtimeSync } from "./useRealtimeSync";

function RealtimeBridge() {
  useRealtimeSync();
  return null;
}

export function SocketProvider({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [isConnected, setIsConnected] = useState(appSocket.connected);
  const refreshAttemptedRef = useRef(false);
  const unavailableNotifiedRef = useRef(false);

  useEffect(() => {
    if (!user) {
      appSocket.disconnect();
      setIsConnected(false);
      return;
    }

    const onConnect = () => {
      refreshAttemptedRef.current = false;
      unavailableNotifiedRef.current = false;
      setIsConnected(true);
    };

    const onDisconnect = () => {
      setIsConnected(false);
    };

    const onConnectError = (error: Error & { data?: { code?: string } }) => {
      setIsConnected(false);
      const unauthorized =
        error.message === "UNAUTHORIZED" || error.data?.code === "UNAUTHORIZED";
      if (!unauthorized) {
        if (!unavailableNotifiedRef.current) {
          unavailableNotifiedRef.current = true;
          toast.error("Live updates are unavailable");
        }
        return;
      }

      if (refreshAttemptedRef.current) {
        void logout();
        toast.error("Your session expired. Please sign in again.");
        return;
      }

      refreshAttemptedRef.current = true;
      void refreshSession()
        .then(() => {
          appSocket.connect();
        })
        .catch(() => {
          void logout();
          toast.error("Your session expired. Please sign in again.");
        });
    };

    appSocket.on("connect", onConnect);
    appSocket.on("disconnect", onDisconnect);
    appSocket.on("connect_error", onConnectError);
    appSocket.connect();

    return () => {
      appSocket.off("connect", onConnect);
      appSocket.off("disconnect", onDisconnect);
      appSocket.off("connect_error", onConnectError);
      appSocket.disconnect();
      setIsConnected(false);
    };
  }, [user, logout]);

  const value = useMemo(
    () => ({ socket: appSocket, isConnected }),
    [isConnected],
  );

  return (
    <SocketContext.Provider value={value}>
      <RealtimeBridge />
      {children}
    </SocketContext.Provider>
  );
}
