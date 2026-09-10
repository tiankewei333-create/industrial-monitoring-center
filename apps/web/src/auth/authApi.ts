import type { AuthSession, UserRole } from "./authStorage";

interface MockAccount {
  username: string;
  password: string;
  role: UserRole;
  displayName: string;
}

/** Day2 Mock — 后续换成 imc-api POST /auth/login */
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

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function login(
  username: string,
  password: string,
): Promise<AuthSession> {
  await delay(350);

  const found = MOCK_ACCOUNTS.find(
    (a) => a.username === username.trim() && a.password === password,
  );

  if (!found) {
    throw new Error("账号或密码错误");
  }

  return {
    token: `mock.${found.username}.${Date.now()}`,
    user: {
      username: found.username,
      role: found.role,
      displayName: found.displayName,
    },
  };
}
