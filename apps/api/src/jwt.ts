import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import type { UserRole } from "./authTypes.js";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET?.trim() || "change-me-in-production",
);
const ISSUER = "imc-api";
const TTL = process.env.JWT_TTL ?? "12h";

export type AccessTokenClaims = JWTPayload & {
  sub: string;
  role: UserRole;
  displayName: string;
};

export async function signAccessToken(user: {
  username: string;
  role: UserRole;
  displayName: string;
}): Promise<string> {
  return new SignJWT({
    role: user.role,
    displayName: user.displayName,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.username)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(TTL)
    .sign(SECRET);
}

export async function verifyAccessToken(
  token: string,
): Promise<AccessTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET, { issuer: ISSUER });
    if (!payload.sub || typeof payload.role !== "string") return null;
    return payload as AccessTokenClaims;
  } catch {
    return null;
  }
}

export function bearerToken(authHeader: string | undefined): string {
  if (!authHeader?.startsWith("Bearer ")) return "";
  return authHeader.slice(7).trim();
}
