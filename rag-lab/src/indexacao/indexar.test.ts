import assert from "node:assert/strict";
import { test } from "node:test";
import { arquivosAfetados, parametrosDeInsercao } from "./indexar.js";
import type { ChunkComEmbedding } from "./indexar.js";
import type { Chunk } from "../tipos.js";

function criarChunk(parcial: Partial<Chunk>): Chunk {
  return {
    arquivoOrigem: "agents/exemplo.md",
    indice: 0,
    offsetInicio: 0,
    offsetFim: 10,
    texto: "texto de exemplo",
    ...parcial,
  };
}

test("arquivosAfetados remove duplicatas mantendo a ordem de primeira aparicao", () => {
  const itens: ChunkComEmbedding[] = [
    { chunk: criarChunk({ arquivoOrigem: "agents/a.md" }), embedding: [0, 0] },
    { chunk: criarChunk({ arquivoOrigem: "agents/b.md" }), embedding: [0, 0] },
    { chunk: criarChunk({ arquivoOrigem: "agents/a.md", indice: 1 }), embedding: [0, 0] },
  ];

  assert.deepEqual(arquivosAfetados(itens), ["agents/a.md", "agents/b.md"]);
});

test("arquivosAfetados de lista vazia retorna lista vazia", () => {
  assert.deepEqual(arquivosAfetados([]), []);
});

test("parametrosDeInsercao mantem a ordem esperada pela query SQL", () => {
  const item: ChunkComEmbedding = {
    chunk: criarChunk({
      arquivoOrigem: "skills/nestjs-arquitetura/SKILL.md",
      indice: 2,
      offsetInicio: 1600,
      offsetFim: 2400,
      texto: "conteudo do chunk",
    }),
    embedding: [0.1, -0.2, 0.3],
  };

  assert.deepEqual(parametrosDeInsercao(item), [
    "skills/nestjs-arquitetura/SKILL.md",
    2,
    1600,
    2400,
    "conteudo do chunk",
    "[0.1,-0.2,0.3]",
  ]);
});

test("parametrosDeInsercao serializa o embedding como literal de vetor do pgvector", () => {
  const item: ChunkComEmbedding = {
    chunk: criarChunk({}),
    embedding: [1, 2, 3],
  };

  const [, , , , , embeddingSql] = parametrosDeInsercao(item);
  assert.equal(embeddingSql, "[1,2,3]");
});
