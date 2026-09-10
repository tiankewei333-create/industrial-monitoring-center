export type UserRole = "observer" | "operator" | "admin";

export interface AuthUser {
  username: string;
  role: UserRole;
  displayName: string;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
}

const TOKEN_KEY = "imc_token";
const USER_KEY = "imc_user";

export function getSession(): AuthSession | null {
  const token = localStorage.getItem(TOKEN_KEY);
  const raw = localStorage.getItem(USER_KEY);
  if (!token || !raw) return null;
  try {
    const user = JSON.parse(raw) as AuthUser;
    return { token, user };
  } catch {
    clearSession();
    return null;
  }
}

export function setSession(session: AuthSession) {
  localStorage.setItem(TOKEN_KEY, session.token);
  localStorage.setItem(USER_KEY, JSON.stringify(session.user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isAuthenticated() {
  return getSession() !== null;
}
