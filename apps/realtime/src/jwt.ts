import { jwtVerify, type JWTPayload } from "jose";
import type { UserRole } from "@imc/shared-types";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET?.trim() || "change-me-in-production",
);
const ISSUER = "imc-api";

export type AccessTokenClaims = JWTPayload & {
  sub: string;
  role: UserRole;
  displayName: string;
};

const MOCK_ROLES: Record<string, UserRole> = {
  observer: "observer",
  operator: "operator",
  admin: "admin",
};

function titleCase(name: string) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Local `dev:live` mock tokens: `mock.{role}.{ts}` — never in production. */
export function parseMockToken(token: string): AccessTokenClaims | null {
  if (process.env.NODE_ENV === "production") return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "mock") return null;
  const role = MOCK_ROLES[parts[1]];
  if (!role) return null;
  return {
    sub: parts[1],
    role,
    displayName: titleCase(parts[1]),
  };
}

export async function verifyAccessToken(
  token: string,
): Promise<AccessTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET, { issuer: ISSUER });
    if (!payload.sub || typeof payload.role !== "string") return null;
    return payload as AccessTokenClaims;
  } catch {
    return parseMockToken(token);
  }
}
