import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@teamboard/shared";
import { io, type Socket } from "socket.io-client";

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/** Same-origin in dev (Vite proxies /socket.io) and production. */
export function createAppSocket(): AppSocket {
  return io({
    autoConnect: false,
    withCredentials: true,
    transports: ["websocket", "polling"],
  });
}

export const appSocket = createAppSocket();
