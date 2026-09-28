import { Pool } from "pg";

let pool: Pool | undefined;

export function obterPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL nao configurada");
    }
    pool = new Pool({ connectionString });
  }
  return pool;
}

export async function encerrarPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
