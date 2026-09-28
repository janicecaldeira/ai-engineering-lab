import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Pool } from "pg";

const diretorioAtual = path.dirname(fileURLToPath(import.meta.url));
const CAMINHO_SCHEMA = path.join(diretorioAtual, "schema.sql");

export async function aplicarSchema(pool: Pool): Promise<void> {
  const sql = await readFile(CAMINHO_SCHEMA, "utf8");
  await pool.query(sql);
}
