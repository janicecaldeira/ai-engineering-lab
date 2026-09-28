import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import type { Pool } from "pg";
import {
  schemaEntradaBuscarChunks,
  buscarChunksHandler,
  type DependenciasBuscarChunks,
} from "./buscar-chunks.js";

const schemaEntrada = z.object(schemaEntradaBuscarChunks);

function textoDoPrimeiroBloco(conteudo: unknown): string {
  if (!Array.isArray(conteudo) || conteudo.length === 0) {
    throw new Error("conteudo vazio ou nao e uma lista de blocos");
  }
  const bloco = conteudo[0] as { type?: unknown; text?: unknown };
  assert.equal(bloco.type, "text");
  assert.equal(typeof bloco.text, "string");
  return bloco.text as string;
}

test("schema rejeita query vazia", () => {
  assert.equal(schemaEntrada.safeParse({ query: "" }).success, false);
});

test("schema rejeita query so com espacos", () => {
  assert.equal(schemaEntrada.safeParse({ query: "   " }).success, false);
});

test("schema aceita query valida sem limite", () => {
  const resultado = schemaEntrada.safeParse({ query: "como funciona o retrieval" });
  assert.equal(resultado.success, true);
});

test("schema rejeita limite zero", () => {
  assert.equal(schemaEntrada.safeParse({ query: "oi", limite: 0 }).success, false);
});

test("schema rejeita limite negativo", () => {
  assert.equal(schemaEntrada.safeParse({ query: "oi", limite: -3 }).success, false);
});

test("schema rejeita limite nao inteiro", () => {
  assert.equal(schemaEntrada.safeParse({ query: "oi", limite: 1.5 }).success, false);
});

test("schema aceita limite positivo", () => {
  assert.equal(schemaEntrada.safeParse({ query: "oi", limite: 3 }).success, true);
});

interface LinhaFalsa {
  id: number;
  arquivo_origem: string;
  indice: number;
  texto: string;
  distancia: number;
}

function criarPoolFalso(linhas: LinhaFalsa[], capturarParametros?: (parametros: unknown[]) => void): Pool {
  return {
    query: async (_sql: string, parametros?: unknown[]) => {
      capturarParametros?.(parametros ?? []);
      return { rows: linhas };
    },
  } as unknown as Pool;
}

function criarDependenciasFalsas(opcoes: {
  totalChunks: number;
  linhas: LinhaFalsa[];
  capturarParametros?: (parametros: unknown[]) => void;
}): DependenciasBuscarChunks {
  return {
    pool: criarPoolFalso(opcoes.linhas, opcoes.capturarParametros),
    gerarEmbeddingConsulta: async () => [0.1, 0.2, 0.3],
    contarChunks: async () => opcoes.totalChunks,
  };
}

test("mapeia os resultados da busca para a forma da tool", async () => {
  const deps = criarDependenciasFalsas({
    totalChunks: 10,
    linhas: [
      { id: 1, arquivo_origem: "agents/dedalo.md", indice: 0, texto: "trecho a", distancia: 0.12 },
      { id: 2, arquivo_origem: "agents/dedalo.md", indice: 1, texto: "trecho b", distancia: 0.34 },
    ],
  });

  const resultado = await buscarChunksHandler(deps, { query: "idempotencia" });

  assert.equal(resultado.isError, undefined);
  assert.deepEqual(resultado.structuredContent, {
    resultados: [
      { arquivoOrigem: "agents/dedalo.md", indice: 0, distancia: 0.12, texto: "trecho a" },
      { arquivoOrigem: "agents/dedalo.md", indice: 1, distancia: 0.34, texto: "trecho b" },
    ],
  });
  assert.match(textoDoPrimeiroBloco(resultado.content), /agents\/dedalo\.md#0/);
});

test("usa o limite padrao (5) quando nenhum limite e informado", async () => {
  let parametrosCapturados: unknown[] = [];
  const deps = criarDependenciasFalsas({
    totalChunks: 10,
    linhas: [],
    capturarParametros: (parametros) => {
      parametrosCapturados = parametros;
    },
  });

  await buscarChunksHandler(deps, { query: "idempotencia" });

  assert.equal(parametrosCapturados[1], 5);
});

test("respeita o limite informado", async () => {
  let parametrosCapturados: unknown[] = [];
  const deps = criarDependenciasFalsas({
    totalChunks: 10,
    linhas: [],
    capturarParametros: (parametros) => {
      parametrosCapturados = parametros;
    },
  });

  await buscarChunksHandler(deps, { query: "idempotencia", limite: 2 });

  assert.equal(parametrosCapturados[1], 2);
});

test("limite maior que o total de chunks indexados lanca erro", async () => {
  const deps = criarDependenciasFalsas({ totalChunks: 3, linhas: [] });

  await assert.rejects(
    () => buscarChunksHandler(deps, { query: "idempotencia", limite: 10 }),
    /maior que o total de chunks indexados \(3\)/,
  );
});

test("corpus vazio lanca erro", async () => {
  const deps = criarDependenciasFalsas({ totalChunks: 0, linhas: [] });

  await assert.rejects(() => buscarChunksHandler(deps, { query: "idempotencia" }), /corpus vazio/);
});
