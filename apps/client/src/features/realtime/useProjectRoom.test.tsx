import type { JoinProjectAck } from "@teamboard/shared";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProjectRoom } from "./useProjectRoom";

const { fakeSocket, listeners, joins } = vi.hoisted(() => {
  const handlers = new Map<string, Set<(payload: unknown) => void>>();
  const joinAcks: ((response: JoinProjectAck) => void)[] = [];
  const socket = {
    connected: true,
    connect: vi.fn(),
    disconnect: vi.fn(),
    on: vi.fn((event: string, handler: (payload: unknown) => void) => {
      const set = handlers.get(event) ?? new Set();
      set.add(handler);
      handlers.set(event, set);
    }),
    off: vi.fn((event: string, handler: (payload: unknown) => void) => {
      handlers.get(event)?.delete(handler);
    }),
    emit: vi.fn(
      (
        event: string,
        _payload: unknown,
        ack?: (response: JoinProjectAck) => void,
      ) => {
        if (event === "project:join" && ack) joinAcks.push(ack);
      },
    ),
  };
  return { fakeSocket: socket, listeners: handlers, joins: joinAcks };
});

vi.mock("./useSocket", () => ({
  useSocket: () => ({ socket: fakeSocket, isConnected: true }),
}));

const projectId = "33333333-3333-4333-8333-333333333333";

function fire(event: string, payload?: unknown) {
  for (const handler of [...(listeners.get(event) ?? [])]) {
    handler(payload);
  }
}

beforeEach(() => {
  listeners.clear();
  joins.length = 0;
  fakeSocket.connected = true;
  fakeSocket.emit.mockClear();
  fakeSocket.on.mockClear();
  fakeSocket.off.mockClear();
});

describe("useProjectRoom", () => {
  it("joins on mount and applies the ack's online users", () => {
    const { result } = renderHook(() => useProjectRoom(projectId));

    expect(fakeSocket.emit).toHaveBeenCalledWith(
      "project:join",
      { projectId },
      expect.any(Function),
    );
    act(() => {
      joins[0]({ ok: true, onlineUserIds: ["maya", "dev"] });
    });
    expect(result.current.onlineUserIds).toEqual(["maya", "dev"]);
  });

  it("rejoins after a reconnect", () => {
    const { result } = renderHook(() => useProjectRoom(projectId));
    act(() => {
      joins[0]({ ok: true, onlineUserIds: ["maya"] });
    });

    act(() => fire("connect"));
    expect(joins).toHaveLength(2);

    act(() => {
      joins[1]({ ok: true, onlineUserIds: ["maya", "sam"] });
    });
    expect(result.current.onlineUserIds).toEqual(["maya", "sam"]);
  });

  it("applies matching presence updates and ignores other projects", () => {
    const { result } = renderHook(() => useProjectRoom(projectId));

    act(() => {
      fire("presence:update", {
        projectId: "another-project",
        onlineUserIds: ["sam"],
      });
    });
    expect(result.current.onlineUserIds).toEqual([]);

    act(() => {
      fire("presence:update", { projectId, onlineUserIds: ["maya", "dev"] });
    });
    expect(result.current.onlineUserIds).toEqual(["maya", "dev"]);
  });

  it("leaves the room and stops listening on unmount", () => {
    const { unmount } = renderHook(() => useProjectRoom(projectId));

    unmount();

    expect(fakeSocket.emit).toHaveBeenCalledWith("project:leave", {
      projectId,
    });
    expect(listeners.get("connect")?.size).toBe(0);
    expect(listeners.get("presence:update")?.size).toBe(0);
  });

  it("ignores a failed ack without throwing", () => {
    const { result } = renderHook(() => useProjectRoom(projectId));

    act(() => {
      joins[0]({ ok: false, code: "NOT_FOUND" });
    });

    expect(result.current.onlineUserIds).toEqual([]);
  });

  it("connects the socket when it starts disconnected", () => {
    fakeSocket.connected = false;
    renderHook(() => useProjectRoom(projectId));

    expect(fakeSocket.connect).toHaveBeenCalledTimes(1);
    expect(fakeSocket.emit).not.toHaveBeenCalledWith(
      "project:join",
      expect.anything(),
      expect.anything(),
    );
  });
});
