const DEFAULT_JWT = "change-me-in-production";

export function assertJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim() || DEFAULT_JWT;
  if (
    process.env.NODE_ENV === "production" &&
    secret === DEFAULT_JWT &&
    process.env.IMC_ALLOW_DEFAULT_JWT !== "true"
  ) {
    console.error(
      "[api] JWT_SECRET must be set in production (or IMC_ALLOW_DEFAULT_JWT=true for lab)",
    );
    process.exit(1);
  }
  if (secret === DEFAULT_JWT) {
    console.warn("[api] JWT_SECRET is the development default — do not expose this host");
  }
}

const loginHits = new Map<string, { n: number; t: number }>();

/** True when this IP should be rejected (HTTP 429). */
export function loginRateLimited(ip: string, max = 20, windowMs = 60_000) {
  const now = Date.now();
  const row = loginHits.get(ip);
  if (!row || now - row.t > windowMs) {
    loginHits.set(ip, { n: 1, t: now });
    return false;
  }
  row.n += 1;
  return row.n > max;
}

export function corsOrigin(): boolean | string[] {
  const raw = process.env.CORS_ORIGIN?.trim();
  if (raw) {
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return process.env.NODE_ENV !== "production";
}
