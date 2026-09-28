import { z } from "zod";
import type { Pool } from "pg";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { buscarChunksSimilares, contextoSuficiente } from "../../../rag-lab/src/retrieval/buscar.js";
import type { ResultadoBusca } from "../../../rag-lab/src/retrieval/buscar.js";
import { gerarResposta, MENSAGEM_SEM_CONTEXTO } from "../../../rag-lab/src/geracao/responder.js";
import { gerarEmbedding } from "../../../rag-lab/src/embedding/gerar-embedding.js";

export const NOME_TOOL_PERGUNTAR_CORPUS = "perguntar_corpus";

export const schemaEntradaPerguntarCorpus = {
  pergunta: z.string().trim().min(1, "pergunta nao pode ser vazia"),
};

export const schemaSaidaPerguntarCorpus = {
  resposta: z.string(),
  fontes: z.array(z.string()),
};

export type EntradaPerguntarCorpus = {
  pergunta: string;
};

export interface DependenciasPerguntarCorpus {
  pool: Pool;
  gerarEmbeddingConsulta: (texto: string) => Promise<number[]>;
  gerarRespostaGroq: (pergunta: string, contexto: ResultadoBusca[]) => Promise<string>;
}

export function criarDependenciasPadrao(pool: Pool): DependenciasPerguntarCorpus {
  return {
    pool,
    gerarEmbeddingConsulta: gerarEmbedding,
    gerarRespostaGroq: gerarResposta,
  };
}

export async function perguntarCorpusHandler(
  deps: DependenciasPerguntarCorpus,
  entrada: EntradaPerguntarCorpus,
): Promise<CallToolResult> {
  const embeddingPergunta = await deps.gerarEmbeddingConsulta(entrada.pergunta);
  const resultados = await buscarChunksSimilares(deps.pool, embeddingPergunta);

  if (!contextoSuficiente(resultados)) {
    return construirResultado(MENSAGEM_SEM_CONTEXTO, []);
  }

  const resposta = await deps.gerarRespostaGroq(entrada.pergunta, resultados);
  const fontes = [...new Set(resultados.map((resultado) => resultado.arquivoOrigem))];

  return construirResultado(resposta, fontes);
}

function construirResultado(resposta: string, fontes: string[]): CallToolResult {
  const texto = fontes.length > 0 ? `${resposta}\n\nFontes:\n${fontes.map((fonte) => `- ${fonte}`).join("\n")}` : resposta;

  return {
    structuredContent: { resposta, fontes },
    content: [{ type: "text", text: texto }],
  };
}
