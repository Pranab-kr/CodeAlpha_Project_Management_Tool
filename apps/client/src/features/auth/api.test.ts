import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch, setUnauthorizedHandler } from "../../lib/api";

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const unauthorizedBody = {
  error: { code: "UNAUTHORIZED", message: "Unauthorized" },
};

describe("apiFetch", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let refreshCalls: number;

  beforeEach(() => {
    refreshCalls = 0;
    fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) {
        refreshCalls += 1;
        return jsonResponse(200, { data: { user: { id: "u1" } } });
      }
      return jsonResponse(200, { data: { ok: true } });
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setUnauthorizedHandler(() => {});
  });

  it("refreshes once and retries the original request after a 401", async () => {
    let projectCalls = 0;
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) {
        refreshCalls += 1;
        return jsonResponse(200, { data: { user: { id: "u1" } } });
      }
      projectCalls += 1;
      if (projectCalls === 1) {
        return jsonResponse(401, unauthorizedBody);
      }
      return jsonResponse(200, { data: { ok: true } });
    });

    await expect(apiFetch("/projects")).resolves.toEqual({ ok: true });
    expect(refreshCalls).toBe(1);
    expect(projectCalls).toBe(2);
  });

  it("single-flights concurrent refreshes", async () => {
    let projectCalls = 0;
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) {
        refreshCalls += 1;
        return jsonResponse(200, { data: { user: { id: "u1" } } });
      }
      projectCalls += 1;
      if (projectCalls <= 2) {
        return jsonResponse(401, unauthorizedBody);
      }
      return jsonResponse(200, { data: { ok: true } });
    });

    const [a, b] = await Promise.all([
      apiFetch("/projects"),
      apiFetch("/tasks"),
    ]);
    expect(a).toEqual({ ok: true });
    expect(b).toEqual({ ok: true });
    expect(refreshCalls).toBe(1);
  });

  it("calls the unauthorized handler when the refresh fails", async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) {
        refreshCalls += 1;
        return jsonResponse(401, unauthorizedBody);
      }
      return jsonResponse(401, unauthorizedBody);
    });

    await expect(apiFetch("/projects")).rejects.toBeInstanceOf(ApiError);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(refreshCalls).toBe(1);
  });

  it("does not refresh on auth endpoints themselves", async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse(401, unauthorizedBody),
    );

    const error = await apiFetch("/auth/login", {
      method: "POST",
      body: { email: "a@example.com", password: "wrong" },
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(401);
    expect(refreshCalls).toBe(0);
  });
});
