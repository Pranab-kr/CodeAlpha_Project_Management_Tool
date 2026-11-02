import { ACCESS_COOKIE } from "@teamboard/shared";
import { verifyAccessToken } from "../lib/tokens.js";
import type { AppSocket } from "./types.js";

/** Minimal cookie-header reader; socket handshakes carry no cookie-parser. */
function readHandshakeCookie(header: string, name: string): string | undefined {
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${name}=`)) {
      return decodeURIComponent(trimmed.slice(name.length + 1));
    }
  }
  return undefined;
}

/** Handshake auth reads the access cookie; the client never supplies a user id. */
export async function socketAuth(
  socket: AppSocket,
  next: (err?: Error) => void,
): Promise<void> {
  try {
    const header = socket.handshake.headers.cookie ?? "";
    const token = readHandshakeCookie(header, ACCESS_COOKIE);
    if (!token) throw new Error("UNAUTHORIZED");
    const payload = await verifyAccessToken(token);
    socket.data.user = { id: payload.sub, email: payload.email };
    socket.data.joinedProjects = new Set();
    next();
  } catch {
    const error = new Error("UNAUTHORIZED") as Error & {
      data?: { code: string };
    };
    error.data = { code: "UNAUTHORIZED" };
    next(error);
  }
}
