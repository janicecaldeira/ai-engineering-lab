import { toSql } from "pgvector";
import type { Pool } from "pg";
import type { Chunk } from "../tipos.js";

export interface ChunkComEmbedding {
  chunk: Chunk;
  embedding: number[];
}

export type ParametrosDeInsercao = [
  arquivoOrigem: string,
  indice: number,
  offsetInicio: number,
  offsetFim: number,
  texto: string,
  embeddingSql: string,
];

export function arquivosAfetados(itens: ChunkComEmbedding[]): string[] {
  return [...new Set(itens.map((item) => item.chunk.arquivoOrigem))];
}

export function parametrosDeInsercao(item: ChunkComEmbedding): ParametrosDeInsercao {
  return [
    item.chunk.arquivoOrigem,
    item.chunk.indice,
    item.chunk.offsetInicio,
    item.chunk.offsetFim,
    item.chunk.texto,
    toSql(item.embedding) as string,
  ];
}

export async function indexarChunks(pool: Pool, itens: ChunkComEmbedding[]): Promise<number> {
  if (itens.length === 0) {
    return 0;
  }

  const arquivos = arquivosAfetados(itens);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM chunks WHERE arquivo_origem = ANY($1::text[])", [arquivos]);

    for (const item of itens) {
      await client.query(
        `INSERT INTO chunks (arquivo_origem, indice, offset_inicio, offset_fim, texto, embedding)
         VALUES ($1, $2, $3, $4, $5, $6::vector)`,
        parametrosDeInsercao(item),
      );
    }

    await client.query("COMMIT");
    return itens.length;
  } catch (erro) {
    await client.query("ROLLBACK");
    throw erro;
  } finally {
    client.release();
  }
}
