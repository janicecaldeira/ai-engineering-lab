import { z } from "zod";
import type { Pool } from "pg";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { buscarChunksSimilares, LIMITE_PADRAO } from "../../../rag-lab/src/retrieval/buscar.js";
import { gerarEmbedding } from "../../../rag-lab/src/embedding/gerar-embedding.js";

export const NOME_TOOL_BUSCAR_CHUNKS = "buscar_chunks";

export const schemaEntradaBuscarChunks = {
  query: z.string().trim().min(1, "query nao pode ser vazia"),
  limite: z.number().int().positive().optional(),
};

export const schemaSaidaBuscarChunks = {
  resultados: z.array(
    z.object({
      arquivoOrigem: z.string(),
      indice: z.number(),
      distancia: z.number(),
      texto: z.string(),
    }),
  ),
};

export type EntradaBuscarChunks = {
  query: string;
  limite?: number | undefined;
};

export interface DependenciasBuscarChunks {
  pool: Pool;
  gerarEmbeddingConsulta: (texto: string) => Promise<number[]>;
  contarChunks: () => Promise<number>;
}

export function criarDependenciasPadrao(pool: Pool): DependenciasBuscarChunks {
  return {
    pool,
    gerarEmbeddingConsulta: gerarEmbedding,
    contarChunks: () => contarChunksNoPostgres(pool),
  };
}

async function contarChunksNoPostgres(pool: Pool): Promise<number> {
  const resultado = await pool.query<{ total: number }>("SELECT COUNT(*)::int AS total FROM chunks");
  return resultado.rows[0]?.total ?? 0;
}

export async function buscarChunksHandler(
  deps: DependenciasBuscarChunks,
  entrada: EntradaBuscarChunks,
): Promise<CallToolResult> {
  const limite = entrada.limite ?? LIMITE_PADRAO;

  const totalChunks = await deps.contarChunks();
  if (totalChunks === 0) {
    throw new Error("corpus vazio: nenhum chunk indexado no Postgres");
  }
  if (limite > totalChunks) {
    throw new Error(`limite ${limite} maior que o total de chunks indexados (${totalChunks})`);
  }

  const embeddingConsulta = await deps.gerarEmbeddingConsulta(entrada.query);
  const resultados = await buscarChunksSimilares(deps.pool, embeddingConsulta, limite);

  const resultadosSaida = resultados.map((resultado) => ({
    arquivoOrigem: resultado.arquivoOrigem,
    indice: resultado.indice,
    distancia: resultado.distancia,
    texto: resultado.texto,
  }));

  return {
    structuredContent: { resultados: resultadosSaida },
    content: [
      {
        type: "text",
        text: resultadosSaida
          .map((resultado) => `distancia=${resultado.distancia.toFixed(4)}  ${resultado.arquivoOrigem}#${resultado.indice}`)
          .join("\n"),
      },
    ],
  };
}
