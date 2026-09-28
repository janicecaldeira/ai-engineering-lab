import assert from "node:assert/strict";
import { test } from "node:test";
import { chunkarDocumento, dividirTextoEmChunks } from "./chunking.js";
import type { DocumentoFonte } from "../tipos.js";

test("texto vazio nao gera chunk", () => {
  assert.deepEqual(dividirTextoEmChunks(""), []);
});

test("texto menor que o tamanho maximo vira um unico chunk", () => {
  const texto = "conteudo curto de exemplo";
  const chunks = dividirTextoEmChunks(texto, { tamanhoMaximo: 800, sobreposicao: 120 });

  assert.equal(chunks.length, 1);
  assert.deepEqual(chunks[0], {
    indice: 0,
    offsetInicio: 0,
    offsetFim: texto.length,
    texto,
  });
});

test("texto maior que o tamanho maximo gera chunks com sobreposicao", () => {
  const texto = "a".repeat(2000);
  const chunks = dividirTextoEmChunks(texto, { tamanhoMaximo: 800, sobreposicao: 120 });

  assert.equal(chunks.length, 3);
  assert.deepEqual(
    chunks.map((chunk) => [chunk.indice, chunk.offsetInicio, chunk.offsetFim]),
    [
      [0, 0, 800],
      [1, 680, 1480],
      [2, 1360, 2000],
    ],
  );
});

test("chunks cobrem o texto inteiro sem buraco", () => {
  const texto = "b".repeat(2500);
  const opcoes = { tamanhoMaximo: 800, sobreposicao: 120 };
  const chunks = dividirTextoEmChunks(texto, opcoes);

  assert.equal(chunks[0]?.offsetInicio, 0);
  assert.equal(chunks.at(-1)?.offsetFim, texto.length);
  for (let i = 1; i < chunks.length; i += 1) {
    const anterior = chunks[i - 1]!;
    const atual = chunks[i]!;
    assert.ok(atual.offsetInicio <= anterior.offsetFim, "chunk seguinte nao pode deixar buraco");
  }
});

test("cada chunk.texto bate com o slice do texto original", () => {
  const texto = "0123456789".repeat(300);
  const chunks = dividirTextoEmChunks(texto, { tamanhoMaximo: 800, sobreposicao: 120 });

  for (const chunk of chunks) {
    assert.equal(chunk.texto, texto.slice(chunk.offsetInicio, chunk.offsetFim));
  }
});

test("sobreposicao maior ou igual ao tamanho maximo lanca erro", () => {
  assert.throws(() => dividirTextoEmChunks("qualquer texto", { tamanhoMaximo: 100, sobreposicao: 100 }));
  assert.throws(() => dividirTextoEmChunks("qualquer texto", { tamanhoMaximo: 100, sobreposicao: 150 }));
});

test("tamanho maximo invalido lanca erro", () => {
  assert.throws(() => dividirTextoEmChunks("qualquer texto", { tamanhoMaximo: 0, sobreposicao: 0 }));
});

test("sobreposicao negativa lanca erro", () => {
  assert.throws(() => dividirTextoEmChunks("qualquer texto", { tamanhoMaximo: 100, sobreposicao: -1 }));
});

test("chunkarDocumento preenche arquivoOrigem em cada chunk", () => {
  const documento: DocumentoFonte = {
    caminhoRelativo: "agents/exemplo.md",
    caminhoAbsoluto: "/tmp/agents/exemplo.md",
    conteudo: "texto de exemplo com tamanho suficiente para um unico chunk",
  };

  const chunks = chunkarDocumento(documento);

  assert.equal(chunks.length, 1);
  assert.equal(chunks[0]?.arquivoOrigem, "agents/exemplo.md");
  assert.equal(chunks[0]?.texto, documento.conteudo);
});
