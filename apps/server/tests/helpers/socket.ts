import { createServer, type Server } from "node:http";
import type {
  ClientToServerEvents,
  JoinProjectAck,
  ServerToClientEvents,
} from "@teamboard/shared";
import { io as clientIo, type Socket as ClientSocket } from "socket.io-client";
import { createApp } from "../../src/app.js";
import { closeRealtime, initRealtime } from "../../src/realtime/io.js";
import { resetPresence } from "../../src/realtime/presence.js";

export type TestSocket = ClientSocket<
  ServerToClientEvents,
  ClientToServerEvents
>;

interface ActiveServer {
  url: string;
  httpServer: Server;
}

let active: ActiveServer | null = null;
const sockets: TestSocket[] = [];

export async function startSocketServer(): Promise<ActiveServer> {
  await stopSocketServer();

  const httpServer = createServer(createApp());
  initRealtime(httpServer);
  await new Promise<void>((resolve) => {
    httpServer.listen(0, "127.0.0.1", resolve);
  });

  const address = httpServer.address();
  if (!address || typeof address === "string") {
    throw new Error("Socket test server did not bind a port");
  }

  active = { url: `http://127.0.0.1:${address.port}`, httpServer };
  return active;
}

export async function stopSocketServer(): Promise<void> {
  for (const socket of sockets.splice(0)) {
    socket.removeAllListeners();
    socket.disconnect();
  }

  const current = active;
  active = null;
  await closeRealtime();
  if (current) {
    await new Promise<void>((resolve) => {
      current.httpServer.close(() => resolve());
      current.httpServer.closeAllConnections();
    });
  }
  resetPresence();
}

export function connectSocket(
  url: string,
  cookies: string | string[] = [],
): TestSocket {
  const cookieHeader = Array.isArray(cookies) ? cookies.join("; ") : cookies;
  const socket: TestSocket = clientIo(url, {
    path: "/socket.io",
    transports: ["websocket"],
    forceNew: true,
    autoConnect: true,
    reconnection: false,
    extraHeaders: cookieHeader ? { Cookie: cookieHeader } : {},
  });
  sockets.push(socket);
  return socket;
}

export function waitForConnect(
  socket: TestSocket,
  timeoutMs = 2_000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (socket.connected) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for socket connect"));
    }, timeoutMs);
    const onConnect = () => {
      cleanup();
      resolve();
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      clearTimeout(timer);
      socket.off("connect", onConnect);
      socket.off("connect_error", onError);
    };
    socket.on("connect", onConnect);
    socket.on("connect_error", onError);
  });
}

export function waitForConnectError(
  socket: TestSocket,
  timeoutMs = 2_000,
): Promise<Error> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for socket connect_error"));
    }, timeoutMs);
    const onConnect = () => {
      cleanup();
      reject(new Error("Socket connected but was expected to fail"));
    };
    const onError = (error: Error) => {
      cleanup();
      resolve(error);
    };
    const cleanup = () => {
      clearTimeout(timer);
      socket.off("connect", onConnect);
      socket.off("connect_error", onError);
    };
    socket.on("connect", onConnect);
    socket.on("connect_error", onError);
  });
}

export function waitForEvent<K extends keyof ServerToClientEvents>(
  socket: TestSocket,
  event: K,
  timeoutMs = 1_000,
): Promise<Parameters<ServerToClientEvents[K]>[0]> {
  return new Promise((resolve, reject) => {
    const handler = (payload: Parameters<ServerToClientEvents[K]>[0]) => {
      clearTimeout(timer);
      resolve(payload);
    };
    const timer = setTimeout(() => {
      socket.off(event, handler as never);
      reject(new Error(`Timed out waiting for ${String(event)}`));
    }, timeoutMs);
    socket.once(event, handler as never);
  });
}

/** Rejects if the event arrives within the window; resolves otherwise. */
export function expectNoEvent<K extends keyof ServerToClientEvents>(
  socket: TestSocket,
  event: K,
  waitMs = 200,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const handler = (payload: unknown) => {
      clearTimeout(timer);
      socket.off(event, handler as never);
      reject(
        new Error(
          `Expected no ${String(event)} but received ${JSON.stringify(payload)}`,
        ),
      );
    };
    const timer = setTimeout(() => {
      socket.off(event, handler as never);
      resolve();
    }, waitMs);
    socket.on(event, handler as never);
  });
}

/** Joins a project and awaits the ack, failing loudly when it is rejected. */
export function joinProject(
  socket: TestSocket,
  projectId: string,
): Promise<{ ok: true; onlineUserIds: string[] }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Timed out waiting for project:join ack")),
      2_000,
    );
    socket.emit("project:join", { projectId }, (response) => {
      clearTimeout(timer);
      if (!response.ok) {
        reject(new Error(`project:join failed: ${response.code}`));
        return;
      }
      resolve(response);
    });
  });
}

export function joinProjectAck(
  socket: TestSocket,
  projectId: string,
): Promise<JoinProjectAck> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Timed out waiting for project:join ack")),
      2_000,
    );
    socket.emit("project:join", { projectId }, (response) => {
      clearTimeout(timer);
      resolve(response);
    });
  });
}
