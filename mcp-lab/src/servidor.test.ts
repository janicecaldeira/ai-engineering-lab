import assert from "node:assert/strict";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { Pool } from "pg";
import { criarServidor, NOME_SERVIDOR, VERSAO_SERVIDOR, type DependenciasServidor } from "./servidor.js";
import { NOME_TOOL_BUSCAR_CHUNKS } from "./tools/buscar-chunks.js";
import type { DependenciasBuscarChunks } from "./tools/buscar-chunks.js";
import { NOME_TOOL_PERGUNTAR_CORPUS } from "./tools/perguntar-corpus.js";
import type { DependenciasPerguntarCorpus } from "./tools/perguntar-corpus.js";
import {
  NOME_RESOURCE_ARQUIVOS_INDEXADOS,
  URI_RESOURCE_ARQUIVOS_INDEXADOS,
} from "./resources/arquivos-indexados.js";
import type { DependenciasArquivosIndexados } from "./resources/arquivos-indexados.js";
import { NOME_PROMPT_NOVA_PERGUNTA_AVALIACAO } from "./prompts/nova-pergunta-avaliacao.js";
import { MENSAGEM_SEM_CONTEXTO } from "../../rag-lab/src/geracao/responder.js";
import { LIMIAR_DISTANCIA_MAXIMA } from "../../rag-lab/src/retrieval/buscar.js";

function textoDoPrimeiroBloco(conteudo: unknown): string {
  if (!Array.isArray(conteudo) || conteudo.length === 0) {
    throw new Error("conteudo vazio ou nao e uma lista de blocos");
  }
  const bloco = conteudo[0] as { type?: unknown; text?: unknown };
  assert.equal(bloco.type, "text");
  assert.equal(typeof bloco.text, "string");
  return bloco.text as string;
}

interface LinhaFalsa {
  id: number;
  arquivo_origem: string;
  indice: number;
  texto: string;
  distancia: number;
}

function criarDependenciasBuscarChunksFalsas(opcoes: {
  totalChunks: number;
  linhas: LinhaFalsa[];
}): DependenciasBuscarChunks {
  return {
    pool: { query: async () => ({ rows: opcoes.linhas }) } as unknown as Pool,
    gerarEmbeddingConsulta: async () => [0.1, 0.2, 0.3],
    contarChunks: async () => opcoes.totalChunks,
  };
}

function criarDependenciasPerguntarCorpusFalsas(opcoes: {
  linhas: LinhaFalsa[];
  respostaGroq?: () => Promise<string>;
}): DependenciasPerguntarCorpus {
  return {
    pool: { query: async () => ({ rows: opcoes.linhas }) } as unknown as Pool,
    gerarEmbeddingConsulta: async () => [0.1, 0.2, 0.3],
    gerarRespostaGroq: opcoes.respostaGroq ?? (async () => "resposta gerada"),
  };
}

function criarDependenciasArquivosIndexadosFalsas(
  arquivos: Array<{ arquivoOrigem: string; contagemChunks: number }>,
): DependenciasArquivosIndexados {
  return { listarArquivos: async () => arquivos };
}

const DEPS_PADRAO_DE_TESTE: DependenciasServidor = {
  buscarChunks: criarDependenciasBuscarChunksFalsas({ totalChunks: 0, linhas: [] }),
  perguntarCorpus: criarDependenciasPerguntarCorpusFalsas({ linhas: [] }),
  arquivosIndexados: criarDependenciasArquivosIndexadosFalsas([]),
};

async function conectarClienteDeTeste(deps: Partial<DependenciasServidor> = {}) {
  const servidor = criarServidor({ ...DEPS_PADRAO_DE_TESTE, ...deps });
  const [transporteCliente, transporteServidor] = InMemoryTransport.createLinkedPair();
  const cliente = new Client({ name: "cliente-de-teste", version: "0.0.0" });

  await Promise.all([
    servidor.connect(transporteServidor),
    cliente.connect(transporteCliente),
  ]);

  return { servidor, cliente };
}

test("servidor anuncia nome e versao na inicializacao", async () => {
  const { cliente } = await conectarClienteDeTeste();
  const infoServidor = cliente.getServerVersion();

  assert.equal(infoServidor?.name, NOME_SERVIDOR);
  assert.equal(infoServidor?.version, VERSAO_SERVIDOR);
});

test("com as tres primitivas registradas, servidor anuncia as tres capacidades", async () => {
  const { cliente } = await conectarClienteDeTeste();

  const capacidades = cliente.getServerCapabilities();

  assert.ok(capacidades?.tools);
  assert.ok(capacidades?.resources);
  assert.ok(capacidades?.prompts);
});

test("tools/list inclui buscar_chunks e perguntar_corpus", async () => {
  const { cliente } = await conectarClienteDeTeste();

  const { tools } = await cliente.listTools();

  assert.equal(tools.length, 2);
  assert.deepEqual(
    tools.map((tool) => tool.name).sort(),
    [NOME_TOOL_BUSCAR_CHUNKS, NOME_TOOL_PERGUNTAR_CORPUS].sort(),
  );
});

test("resources/list inclui arquivos_indexados", async () => {
  const { cliente } = await conectarClienteDeTeste();

  const { resources } = await cliente.listResources();

  assert.equal(resources.length, 1);
  assert.equal(resources[0]?.name, NOME_RESOURCE_ARQUIVOS_INDEXADOS);
  assert.equal(resources[0]?.uri, URI_RESOURCE_ARQUIVOS_INDEXADOS);
});

test("prompts/list inclui nova_pergunta_avaliacao", async () => {
  const { cliente } = await conectarClienteDeTeste();

  const { prompts } = await cliente.listPrompts();

  assert.equal(prompts.length, 1);
  assert.equal(prompts[0]?.name, NOME_PROMPT_NOVA_PERGUNTA_AVALIACAO);
  assert.deepEqual(
    prompts[0]?.arguments?.map((argumento) => argumento.name),
    ["tema"],
  );
});

test("resources/read arquivos_indexados devolve JSON com arquivo e contagem de chunks", async () => {
  const { cliente } = await conectarClienteDeTeste({
    arquivosIndexados: criarDependenciasArquivosIndexadosFalsas([
      { arquivoOrigem: "agents/dedalo.md", contagemChunks: 8 },
      { arquivoOrigem: "agents/argos.md", contagemChunks: 5 },
    ]),
  });

  const resultado = await cliente.readResource({ uri: URI_RESOURCE_ARQUIVOS_INDEXADOS });

  assert.equal(resultado.contents.length, 1);
  const conteudo = resultado.contents[0] as { text: string; mimeType?: string };
  assert.equal(conteudo.mimeType, "application/json");
  assert.deepEqual(JSON.parse(conteudo.text), [
    { arquivoOrigem: "agents/dedalo.md", contagemChunks: 8 },
    { arquivoOrigem: "agents/argos.md", contagemChunks: 5 },
  ]);
});

test("prompts/get nova_pergunta_avaliacao devolve mensagem no formato do dataset", async () => {
  const { cliente } = await conectarClienteDeTeste();

  const resultado = await cliente.getPrompt({
    name: NOME_PROMPT_NOVA_PERGUNTA_AVALIACAO,
    arguments: { tema: "webhooks" },
  });

  assert.equal(resultado.messages.length, 1);
  const conteudo = resultado.messages[0]?.content as { type: string; text: string };
  assert.equal(conteudo.type, "text");
  assert.match(conteudo.text, /sobre "webhooks"/);
  assert.match(conteudo.text, /"categoria"/);
});

test("tools/call buscar_chunks devolve os chunks mais proximos no formato esperado", async () => {
  const { cliente } = await conectarClienteDeTeste({
    buscarChunks: criarDependenciasBuscarChunksFalsas({
      totalChunks: 5,
      linhas: [{ id: 1, arquivo_origem: "agents/dedalo.md", indice: 0, texto: "trecho", distancia: 0.2 }],
    }),
  });

  const resultado = await cliente.callTool({
    name: NOME_TOOL_BUSCAR_CHUNKS,
    arguments: { query: "idempotencia", limite: 1 },
  });

  assert.equal(resultado.isError, undefined);
  assert.deepEqual(resultado.structuredContent, {
    resultados: [{ arquivoOrigem: "agents/dedalo.md", indice: 0, distancia: 0.2, texto: "trecho" }],
  });
});

test("tools/call buscar_chunks com limite maior que o corpus devolve isError, sem derrubar o servidor", async () => {
  const { cliente } = await conectarClienteDeTeste({
    buscarChunks: criarDependenciasBuscarChunksFalsas({ totalChunks: 2, linhas: [] }),
  });

  const resultado = await cliente.callTool({
    name: NOME_TOOL_BUSCAR_CHUNKS,
    arguments: { query: "idempotencia", limite: 5 },
  });

  assert.equal(resultado.isError, true);
  assert.match(textoDoPrimeiroBloco(resultado.content), /maior que o total de chunks indexados \(2\)/);

  const { tools } = await cliente.listTools();
  assert.equal(tools.length, 2);
});

test("tools/call buscar_chunks com limite zero devolve isError vindo da validacao do schema", async () => {
  const { cliente } = await conectarClienteDeTeste({
    buscarChunks: criarDependenciasBuscarChunksFalsas({ totalChunks: 5, linhas: [] }),
  });

  const resultado = await cliente.callTool({
    name: NOME_TOOL_BUSCAR_CHUNKS,
    arguments: { query: "idempotencia", limite: 0 },
  });

  assert.equal(resultado.isError, true);
});

test("tools/call perguntar_corpus com contexto suficiente devolve resposta e fontes", async () => {
  const { cliente } = await conectarClienteDeTeste({
    perguntarCorpus: criarDependenciasPerguntarCorpusFalsas({
      linhas: [{ id: 1, arquivo_origem: "agents/dedalo.md", indice: 0, texto: "trecho", distancia: 0.2 }],
      respostaGroq: async () => "resposta com base no contexto",
    }),
  });

  const resultado = await cliente.callTool({
    name: NOME_TOOL_PERGUNTAR_CORPUS,
    arguments: { pergunta: "como o dedalo trata idempotencia?" },
  });

  assert.equal(resultado.isError, undefined);
  assert.deepEqual(resultado.structuredContent, {
    resposta: "resposta com base no contexto",
    fontes: ["agents/dedalo.md"],
  });
});

test("tools/call perguntar_corpus com contexto insuficiente devolve a recusa padrao, sem isError", async () => {
  const { cliente } = await conectarClienteDeTeste({
    perguntarCorpus: criarDependenciasPerguntarCorpusFalsas({
      linhas: [
        {
          id: 1,
          arquivo_origem: "fora.md",
          indice: 0,
          texto: "irrelevante",
          distancia: LIMIAR_DISTANCIA_MAXIMA + 0.1,
        },
      ],
    }),
  });

  const resultado = await cliente.callTool({
    name: NOME_TOOL_PERGUNTAR_CORPUS,
    arguments: { pergunta: "qual e a capital da lua?" },
  });

  assert.equal(resultado.isError, undefined);
  assert.deepEqual(resultado.structuredContent, { resposta: MENSAGEM_SEM_CONTEXTO, fontes: [] });
});

test("tools/call perguntar_corpus com pergunta vazia devolve isError vindo da validacao do schema", async () => {
  const { cliente } = await conectarClienteDeTeste();

  const resultado = await cliente.callTool({
    name: NOME_TOOL_PERGUNTAR_CORPUS,
    arguments: { pergunta: "   " },
  });

  assert.equal(resultado.isError, true);
});

test("tools/call perguntar_corpus com Groq indisponivel devolve isError, sem derrubar o servidor nem quebrar buscar_chunks", async () => {
  const { cliente } = await conectarClienteDeTeste({
    perguntarCorpus: criarDependenciasPerguntarCorpusFalsas({
      linhas: [{ id: 1, arquivo_origem: "agents/dedalo.md", indice: 0, texto: "trecho", distancia: 0.1 }],
      respostaGroq: async () => {
        throw new Error("GROQ_API_KEY nao configurada");
      },
    }),
    buscarChunks: criarDependenciasBuscarChunksFalsas({
      totalChunks: 5,
      linhas: [{ id: 1, arquivo_origem: "agents/dedalo.md", indice: 0, texto: "trecho", distancia: 0.2 }],
    }),
  });

  const resultadoPerguntarCorpus = await cliente.callTool({
    name: NOME_TOOL_PERGUNTAR_CORPUS,
    arguments: { pergunta: "como o dedalo trata idempotencia?" },
  });

  assert.equal(resultadoPerguntarCorpus.isError, true);
  assert.match(textoDoPrimeiroBloco(resultadoPerguntarCorpus.content), /GROQ_API_KEY nao configurada/);

  const resultadoBuscarChunks = await cliente.callTool({
    name: NOME_TOOL_BUSCAR_CHUNKS,
    arguments: { query: "idempotencia", limite: 1 },
  });

  assert.equal(resultadoBuscarChunks.isError, undefined);
  assert.deepEqual(resultadoBuscarChunks.structuredContent, {
    resultados: [{ arquivoOrigem: "agents/dedalo.md", indice: 0, distancia: 0.2, texto: "trecho" }],
  });
});
