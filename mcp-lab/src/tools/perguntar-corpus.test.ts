import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import type { Pool } from "pg";
import {
  schemaEntradaPerguntarCorpus,
  perguntarCorpusHandler,
  type DependenciasPerguntarCorpus,
} from "./perguntar-corpus.js";
import { MENSAGEM_SEM_CONTEXTO } from "../../../rag-lab/src/geracao/responder.js";
import { LIMIAR_DISTANCIA_MAXIMA } from "../../../rag-lab/src/retrieval/buscar.js";

const schemaEntrada = z.object(schemaEntradaPerguntarCorpus);

test("schema rejeita pergunta vazia", () => {
  assert.equal(schemaEntrada.safeParse({ pergunta: "" }).success, false);
});

test("schema rejeita pergunta so com espacos", () => {
  assert.equal(schemaEntrada.safeParse({ pergunta: "   " }).success, false);
});

test("schema aceita pergunta valida", () => {
  assert.equal(schemaEntrada.safeParse({ pergunta: "como funciona o retrieval?" }).success, true);
});

interface LinhaFalsa {
  id: number;
  arquivo_origem: string;
  indice: number;
  texto: string;
  distancia: number;
}

function criarDependenciasFalsas(opcoes: {
  linhas: LinhaFalsa[];
  respostaGroq?: (pergunta: string, contexto: unknown[]) => Promise<string>;
}): { deps: DependenciasPerguntarCorpus; chamadasGroq: Array<{ pergunta: string; contexto: unknown[] }> } {
  const chamadasGroq: Array<{ pergunta: string; contexto: unknown[] }> = [];

  const deps: DependenciasPerguntarCorpus = {
    pool: { query: async () => ({ rows: opcoes.linhas }) } as unknown as Pool,
    gerarEmbeddingConsulta: async () => [0.1, 0.2, 0.3],
    gerarRespostaGroq: async (pergunta, contexto) => {
      chamadasGroq.push({ pergunta, contexto });
      return opcoes.respostaGroq ? opcoes.respostaGroq(pergunta, contexto) : "resposta gerada";
    },
  };

  return { deps, chamadasGroq };
}

test("contexto insuficiente devolve a recusa padrao sem chamar o Groq", async () => {
  const { deps, chamadasGroq } = criarDependenciasFalsas({
    linhas: [
      {
        id: 1,
        arquivo_origem: "fora-do-corpus.md",
        indice: 0,
        texto: "irrelevante",
        distancia: LIMIAR_DISTANCIA_MAXIMA + 0.1,
      },
    ],
  });

  const resultado = await perguntarCorpusHandler(deps, { pergunta: "qual e a capital da lua?" });

  assert.equal(resultado.isError, undefined);
  assert.deepEqual(resultado.structuredContent, { resposta: MENSAGEM_SEM_CONTEXTO, fontes: [] });
  assert.equal(chamadasGroq.length, 0);
});

test("contexto suficiente chama o Groq e devolve resposta com fontes unicas", async () => {
  const { deps, chamadasGroq } = criarDependenciasFalsas({
    linhas: [
      { id: 1, arquivo_origem: "agents/dedalo.md", indice: 0, texto: "trecho a", distancia: 0.2 },
      { id: 2, arquivo_origem: "agents/dedalo.md", indice: 1, texto: "trecho b", distancia: 0.3 },
      { id: 3, arquivo_origem: "agents/argos.md", indice: 0, texto: "trecho c", distancia: 0.4 },
    ],
    respostaGroq: async () => "resposta com base no contexto",
  });

  const resultado = await perguntarCorpusHandler(deps, { pergunta: "como o dedalo trata idempotencia?" });

  assert.equal(resultado.isError, undefined);
  assert.deepEqual(resultado.structuredContent, {
    resposta: "resposta com base no contexto",
    fontes: ["agents/dedalo.md", "agents/argos.md"],
  });
  assert.equal(chamadasGroq.length, 1);
  assert.equal(chamadasGroq[0]?.pergunta, "como o dedalo trata idempotencia?");
});

test("erro do Groq propaga como excecao (o servidor converte para isError)", async () => {
  const { deps } = criarDependenciasFalsas({
    linhas: [{ id: 1, arquivo_origem: "agents/dedalo.md", indice: 0, texto: "trecho", distancia: 0.1 }],
    respostaGroq: async () => {
      throw new Error("GROQ_API_KEY nao configurada");
    },
  });

  await assert.rejects(
    () => perguntarCorpusHandler(deps, { pergunta: "qualquer pergunta" }),
    /GROQ_API_KEY nao configurada/,
  );
});
