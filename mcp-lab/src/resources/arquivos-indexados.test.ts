import assert from "node:assert/strict";
import { test } from "node:test";
import { arquivosIndexadosHandler, type DependenciasArquivosIndexados } from "./arquivos-indexados.js";

test("devolve os arquivos indexados como JSON no content da resource", async () => {
  const deps: DependenciasArquivosIndexados = {
    listarArquivos: async () => [
      { arquivoOrigem: "agents/dedalo.md", contagemChunks: 8 },
      { arquivoOrigem: "agents/argos.md", contagemChunks: 5 },
    ],
  };

  const resultado = await arquivosIndexadosHandler(deps, new URL("corpus://arquivos-indexados"));

  assert.equal(resultado.contents.length, 1);
  const conteudo = resultado.contents[0] as { uri: string; mimeType?: string; text: string };
  assert.equal(conteudo.uri, "corpus://arquivos-indexados");
  assert.equal(conteudo.mimeType, "application/json");
  assert.deepEqual(JSON.parse(conteudo.text), [
    { arquivoOrigem: "agents/dedalo.md", contagemChunks: 8 },
    { arquivoOrigem: "agents/argos.md", contagemChunks: 5 },
  ]);
});

test("corpus vazio devolve lista vazia, sem erro", async () => {
  const deps: DependenciasArquivosIndexados = {
    listarArquivos: async () => [],
  };

  const resultado = await arquivosIndexadosHandler(deps, new URL("corpus://arquivos-indexados"));

  const conteudo = resultado.contents[0] as { text: string };
  assert.deepEqual(JSON.parse(conteudo.text), []);
});
