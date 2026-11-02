import { createHash, randomBytes } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { env } from "../config/env.js";

const ISSUER = "teamboard";
const AUDIENCE = "teamboard-web";
const ALGORITHM = "HS256";

const secret = new TextEncoder().encode(env.JWT_SECRET);

export interface AccessTokenPayload {
  sub: string;
  email: string;
}

export async function signAccessToken(user: {
  id: string;
  email: string;
}): Promise<string> {
  return new SignJWT({ email: user.email })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(user.id)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${env.ACCESS_TOKEN_TTL_MINUTES}m`)
    .sign(secret);
}

export async function verifyAccessToken(
  token: string,
): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, secret, {
    issuer: ISSUER,
    audience: AUDIENCE,
    algorithms: [ALGORITHM],
  });
  if (typeof payload.sub !== "string" || typeof payload.email !== "string") {
    throw new Error("Access token is missing the sub or email claim");
  }
  return { sub: payload.sub, email: payload.email };
}

export function generateRefreshToken(): string {
  return randomBytes(48).toString("base64url");
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
