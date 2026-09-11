import type { UserRole } from "./authTypes.js";
import { bearerToken, verifyAccessToken } from "./jwt.js";

export type AuthUser = {
  username: string;
  role: UserRole;
  displayName: string;
};

export async function resolveUser(
  authHeader: string | undefined,
): Promise<AuthUser | null> {
  const token = bearerToken(authHeader);
  if (!token) return null;
  const claims = await verifyAccessToken(token);
  if (!claims?.sub) return null;
  return {
    username: claims.sub,
    role: claims.role as UserRole,
    displayName: String(claims.displayName ?? claims.sub),
  };
}

export async function requireRoles(
  authHeader: string | undefined,
  roles: UserRole[],
) {
  const user = await resolveUser(authHeader);
  if (!user) {
    return { ok: false as const, code: 401 as const, error: "unauthorized" };
  }
  if (!roles.includes(user.role)) {
    return { ok: false as const, code: 403 as const, error: "forbidden" };
  }
  return { ok: true as const, user };
}

export function requireAdmin(authHeader: string | undefined) {
  return requireRoles(authHeader, ["admin"]);
}

export function requireStaff(authHeader: string | undefined) {
  return requireRoles(authHeader, ["admin", "operator"]);
}
