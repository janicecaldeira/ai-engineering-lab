import { toSql } from "pgvector";
import type { Pool } from "pg";

export interface ResultadoBusca {
  id: number;
  arquivoOrigem: string;
  indice: number;
  texto: string;
  distancia: number;
}

export const LIMITE_PADRAO = 5;

export const LIMIAR_DISTANCIA_MAXIMA = 0.65;

export function contextoSuficiente(
  resultados: ResultadoBusca[],
  limiar: number = LIMIAR_DISTANCIA_MAXIMA,
): boolean {
  const melhorResultado = resultados[0];
  return melhorResultado !== undefined && melhorResultado.distancia <= limiar;
}

export async function buscarChunksSimilares(
  pool: Pool,
  embeddingPergunta: number[],
  limite: number = LIMITE_PADRAO,
): Promise<ResultadoBusca[]> {
  const resultado = await pool.query(
    `SELECT id, arquivo_origem, indice, texto, embedding <=> $1::vector AS distancia
     FROM chunks
     ORDER BY embedding <=> $1::vector
     LIMIT $2`,
    [toSql(embeddingPergunta), limite],
  );

  return resultado.rows.map((linha) => ({
    id: Number(linha.id),
    arquivoOrigem: String(linha.arquivo_origem),
    indice: Number(linha.indice),
    texto: String(linha.texto),
    distancia: Number(linha.distancia),
  }));
}
