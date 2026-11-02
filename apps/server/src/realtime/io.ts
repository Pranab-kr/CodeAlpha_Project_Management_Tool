import type { Server as HttpServer } from "node:http";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@teamboard/shared";
import { Server } from "socket.io";
import { socketAuth } from "./auth.js";
import { registerHandlers } from "./handlers.js";
import { resetPresence } from "./presence.js";
import { userRoom } from "./rooms.js";
import type { InterServerEvents, SocketData } from "./types.js";

let io: Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
> | null = null;

export function initRealtime(httpServer: HttpServer) {
  if (io) return io;

  io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    path: "/socket.io",
    serveClient: false,
  });

  io.use(socketAuth);
  io.on("connection", (socket) => {
    void socket.join(userRoom(socket.data.user.id));
    registerHandlers(io as NonNullable<typeof io>, socket);
  });

  return io;
}

export function getIo() {
  return io;
}

/** Closes Socket.IO and clears the singleton plus presence state. */
export async function closeRealtime(): Promise<void> {
  const current = io;
  io = null;
  if (current) {
    await current.close();
  }
  resetPresence();
}
