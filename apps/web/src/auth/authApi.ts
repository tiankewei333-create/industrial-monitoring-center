import type { AuthSession, UserRole } from "./authStorage";

const fromEnv = String(import.meta.env.VITE_API_URL ?? "").trim();
const API_URL = (
  fromEnv ||
  `${window.location.origin}/api`
).replace(/\/$/, "");

interface MockAccount {
  username: string;
  password: string;
  role: UserRole;
  displayName: string;
}

/** Offline fallback when imc-api / Postgres is down. */
const MOCK_ACCOUNTS: MockAccount[] = [
  {
    username: "observer",
    password: "observer123",
    role: "observer",
    displayName: "Observer",
  },
  {
    username: "admin",
    password: "admin123",
    role: "admin",
    displayName: "Admin",
  },
  {
    username: "operator",
    password: "operator123",
    role: "operator",
    displayName: "Operator",
  },
];

function mockLogin(username: string, password: string): AuthSession {
  const found = MOCK_ACCOUNTS.find(
    (a) => a.username === username.trim() && a.password === password,
  );
  if (!found) throw new Error("Invalid username or password");
  return {
    token: `mock.${found.username}.${Date.now()}`,
    user: {
      username: found.username,
      role: found.role,
      displayName: found.displayName,
    },
  };
}

export async function login(
  username: string,
  password: string,
): Promise<AuthSession> {
  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
      signal: AbortSignal.timeout(2500),
    });
    if (res.ok) {
      return (await res.json()) as AuthSession;
    }
    if (res.status === 401) {
      throw new Error("Invalid username or password");
    }
    // API up but unexpected — fall through to mock only on network-ish failures
  } catch (err) {
    if (err instanceof Error && err.message === "Invalid username or password") {
      throw err;
    }
    console.warn("[auth] API unreachable", err);
  }

  // Production builds must talk to imc-api. Mock tokens are lab-only.
  const allowMock =
    !import.meta.env.PROD || import.meta.env.VITE_ALLOW_MOCK_AUTH === "true";
  if (!allowMock) {
    throw new Error(
      "API unreachable. Mock login is disabled in production builds.",
    );
  }

  console.warn("[auth] falling back to mock login (dev / lab only)");
  return mockLogin(username, password);
}

export { API_URL };
