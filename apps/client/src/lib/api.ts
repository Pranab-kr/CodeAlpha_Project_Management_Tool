import type { UserDTO } from "@teamboard/shared";

const API_PREFIX = "/api/v1";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface ApiRequestInit extends Omit<RequestInit, "body"> {
  /** Objects are JSON encoded; primitives pass through untouched. */
  body?: unknown;
}

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | undefined;

/** Registered by AuthProvider so a failed refresh clears the cached user. */
export function setUnauthorizedHandler(handler: UnauthorizedHandler): void {
  unauthorizedHandler = handler;
}

function isAuthPath(path: string): boolean {
  return path.startsWith("/auth/");
}

async function send(path: string, init: ApiRequestInit): Promise<Response> {
  const { body, headers, ...rest } = init;
  const requestHeaders = new Headers(headers);
  let payload: string | undefined;
  if (body !== undefined) {
    payload = JSON.stringify(body);
    requestHeaders.set("Content-Type", "application/json");
  }
  return fetch(`${API_PREFIX}${path}`, {
    credentials: "include",
    ...rest,
    headers: requestHeaders,
    ...(payload === undefined ? {} : { body: payload }),
  });
}

async function toApiError(response: Response): Promise<ApiError> {
  let code = "REQUEST_FAILED";
  let message = `Request failed with status ${response.status}`;
  let details: unknown;
  try {
    const body = (await response.json()) as {
      error?: { code?: string; message?: string; details?: unknown };
    };
    if (body.error?.code) code = body.error.code;
    if (body.error?.message) message = body.error.message;
    details = body.error?.details;
  } catch {
    // Non-JSON error responses keep the generic message.
  }
  return new ApiError(response.status, code, message, details);
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!text) return undefined as T;
  const payload = JSON.parse(text) as { data?: T };
  return payload.data as T;
}

async function performRefresh(): Promise<UserDTO> {
  const response = await send("/auth/refresh", { method: "POST" });
  if (!response.ok) {
    unauthorizedHandler?.();
    throw await toApiError(response);
  }
  const payload = (await response.json()) as { data?: { user?: UserDTO } };
  const user = payload.data?.user;
  if (!user) {
    throw new ApiError(
      500,
      "INVALID_RESPONSE",
      "Refresh response did not include a user",
    );
  }
  return user;
}

let refreshPromise: Promise<UserDTO> | null = null;

/**
 * Single-flight refresh. REST retries and the Phase 6 socket provider share it so
 * one expired access token never rotates the refresh token twice (reuse detection
 * would revoke the whole session family).
 */
export function refreshSession(): Promise<UserDTO> {
  if (!refreshPromise) {
    const promise = performRefresh();
    refreshPromise = promise;
    void promise
      .catch(() => undefined)
      .finally(() => {
        if (refreshPromise === promise) refreshPromise = null;
      });
  }
  return refreshPromise;
}

export async function apiFetch<T>(
  path: string,
  init: ApiRequestInit = {},
): Promise<T> {
  const response = await send(path, init);
  if (response.status === 401 && !isAuthPath(path)) {
    await refreshSession();
    return parseResponse<T>(await send(path, init));
  }
  return parseResponse<T>(response);
}
