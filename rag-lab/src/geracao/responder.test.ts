import assert from "node:assert/strict";
import { test } from "node:test";
import { MENSAGEM_SEM_CONTEXTO, montarPrompt, respostaIndicaRecusa } from "./responder.js";
import type { ResultadoBusca } from "../retrieval/buscar.js";

function criarResultado(parcial: Partial<ResultadoBusca>): ResultadoBusca {
  return {
    id: 1,
    arquivoOrigem: "agents/dedalo.md",
    indice: 0,
    texto: "Modulo por feature, fronteiras explicitas via exports.",
    distancia: 0.4,
    ...parcial,
  };
}

test("prompt inclui a pergunta", () => {
  const prompt = montarPrompt("como organizar modulos?", [criarResultado({})]);
  assert.match(prompt, /Pergunta: como organizar modulos\?/);
});

test("prompt inclui o texto de cada chunk de contexto", () => {
  const resultados = [
    criarResultado({ arquivoOrigem: "agents/dedalo.md", texto: "conteudo do dedalo" }),
    criarResultado({ arquivoOrigem: "skills/nestjs-arquitetura/SKILL.md", texto: "conteudo do skill" }),
  ];

  const prompt = montarPrompt("pergunta qualquer", resultados);

  assert.match(prompt, /conteudo do dedalo/);
  assert.match(prompt, /conteudo do skill/);
  assert.match(prompt, /agents\/dedalo\.md/);
  assert.match(prompt, /skills\/nestjs-arquitetura\/SKILL\.md/);
});

test("prompt instrui a nao inventar e a usar a mensagem padrao quando faltar contexto", () => {
  const prompt = montarPrompt("pergunta qualquer", [criarResultado({})]);

  assert.match(prompt, /Nunca invente/);
  assert.ok(prompt.includes(MENSAGEM_SEM_CONTEXTO));
});

test("prompt numera as fontes na ordem recebida", () => {
  const resultados = [
    criarResultado({ arquivoOrigem: "a.md" }),
    criarResultado({ arquivoOrigem: "b.md" }),
    criarResultado({ arquivoOrigem: "c.md" }),
  ];

  const prompt = montarPrompt("pergunta", resultados);
  const posicaoFonte1 = prompt.indexOf("[Fonte 1: a.md]");
  const posicaoFonte2 = prompt.indexOf("[Fonte 2: b.md]");
  const posicaoFonte3 = prompt.indexOf("[Fonte 3: c.md]");

  assert.ok(posicaoFonte1 >= 0 && posicaoFonte2 > posicaoFonte1 && posicaoFonte3 > posicaoFonte2);
});

test("respostaIndicaRecusa detecta a mensagem padrao, mesmo com texto ao redor", () => {
  assert.equal(respostaIndicaRecusa(MENSAGEM_SEM_CONTEXTO), true);
  assert.equal(
    respostaIndicaRecusa(`Desculpe, ${MENSAGEM_SEM_CONTEXTO} Tente reformular a pergunta.`),
    true,
  );
});

test("respostaIndicaRecusa e insensivel a maiusculas/minusculas", () => {
  assert.equal(respostaIndicaRecusa(MENSAGEM_SEM_CONTEXTO.toUpperCase()), true);
});

test("respostaIndicaRecusa retorna falso para uma resposta normal", () => {
  assert.equal(respostaIndicaRecusa("Os módulos devem ser organizados por feature."), false);
});
