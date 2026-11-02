import { createContext, useContext } from "react";
import type { AppSocket } from "../../lib/socket";

export interface SocketContextValue {
  socket: AppSocket;
  isConnected: boolean;
}

export const SocketContext = createContext<SocketContextValue | null>(null);

export function useSocket(): SocketContextValue {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
}
