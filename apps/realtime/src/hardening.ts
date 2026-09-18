const DEFAULT_JWT = "change-me-in-production";

/** Fail fast in production when JWT_SECRET is still the lab default. */
export function assertJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim() || DEFAULT_JWT;
  if (
    process.env.NODE_ENV === "production" &&
    secret === DEFAULT_JWT &&
    process.env.IMC_ALLOW_DEFAULT_JWT !== "true"
  ) {
    console.error(
      "[realtime] JWT_SECRET must be set in production (or IMC_ALLOW_DEFAULT_JWT=true for lab)",
    );
    process.exit(1);
  }
  if (secret === DEFAULT_JWT) {
    console.warn(
      "[realtime] JWT_SECRET is the development default — do not expose this host",
    );
  }
}
