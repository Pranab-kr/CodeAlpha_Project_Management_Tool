import type { Express } from "express";
import request from "supertest";

export interface TestUser {
  id: string;
  email: string;
  name: string;
  initials: string;
  createdAt: string;
}

export interface TestSession {
  user: TestUser;
  /** Ready-to-send `Cookie` header for both access and refresh cookies. */
  cookies: string;
}

export const TEST_PASSWORD = "Password123!";

export function cookieHeader(response: request.Response): string {
  const setCookies = (response.headers["set-cookie"] ?? []) as unknown as
    string[] | undefined;
  if (!setCookies) return "";
  return setCookies.map((cookie) => cookie.split(";")[0]).join("; ");
}

export async function registerSession(
  app: Express,
  email: string,
  name = "Test User",
): Promise<TestSession> {
  const response = await request(app)
    .post("/api/v1/auth/register")
    .send({ name, email, password: TEST_PASSWORD });
  if (response.status !== 201) {
    throw new Error(
      `Registration failed: ${response.status} ${JSON.stringify(response.body)}`,
    );
  }
  return {
    user: response.body.data.user as TestUser,
    cookies: cookieHeader(response),
  };
}
