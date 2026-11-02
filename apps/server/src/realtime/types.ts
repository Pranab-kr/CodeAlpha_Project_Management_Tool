import type { Server, Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@teamboard/shared";

/** No server-to-server events in a single-instance deployment. */
export type InterServerEvents = Record<string, never>;

export interface SocketData {
  user: { id: string; email: string };
  joinedProjects: Set<string>;
}

export type AppServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export type AppSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;
