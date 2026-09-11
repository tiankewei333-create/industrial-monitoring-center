import pg from "pg";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://imc:imc_dev_password@127.0.0.1:5432/imc";

export const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  max: 10,
});

export async function pingDb() {
  const r = await pool.query("SELECT 1 AS ok");
  return r.rows[0]?.ok === 1;
}
