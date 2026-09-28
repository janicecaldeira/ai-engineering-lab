import assert from "node:assert/strict";
import { test } from "node:test";
import { julgarRecusa, montarRelatorio, resultadoDeErro } from "./avaliar.js";
import type { ResultadoExecucao, ResultadoJulgado } from "./avaliar.js";
import type { ItemAvaliacao } from "../tipos.js";

function criarItem(parcial: Partial<ItemAvaliacao>): ItemAvaliacao {
  return {
    id: "item-teste",
    pergunta: "pergunta de teste",
    categoria: "fora-do-corpus",
    respostaEsperada: null,
    fonteEsperada: null,
    ...parcial,
  };
}

function criarResultadoExecucao(parcial: Partial<ResultadoExecucao>): ResultadoExecucao {
  return {
    item: criarItem({}),
    recusou: true,
    resposta: null,
    fontes: [],
    distanciaMelhorChunk: 0.8,
    ...parcial,
  };
}

test("julgarRecusa: recusou = correto, quando a categoria e fora-do-corpus", () => {
  const resultado = julgarRecusa(criarResultadoExecucao({ recusou: true }));
  assert.equal(resultado.correto, true);
});

test("julgarRecusa: nao recusou = incorreto, quando a categoria e fora-do-corpus", () => {
  const resultado = julgarRecusa(
    criarResultadoExecucao({ recusou: false, resposta: "respondeu algo que nao devia" }),
  );
  assert.equal(resultado.correto, false);
});

test("montarRelatorio calcula taxa de acerto corretamente", () => {
  function criarJulgado(correto: boolean): ResultadoJulgado {
    return { ...criarResultadoExecucao({}), correto, justificativa: "" };
  }

  const relatorio = montarRelatorio([criarJulgado(true), criarJulgado(true), criarJulgado(false), criarJulgado(true)]);

  assert.equal(relatorio.totalItens, 4);
  assert.equal(relatorio.totalCorretos, 3);
  assert.equal(relatorio.taxaDeAcerto, 0.75);
});

test("montarRelatorio com lista vazia nao divide por zero", () => {
  const relatorio = montarRelatorio([]);
  assert.equal(relatorio.totalItens, 0);
  assert.equal(relatorio.taxaDeAcerto, 0);
});

test("montarRelatorio com tudo correto da taxa 1", () => {
  const julgado: ResultadoJulgado = { ...criarResultadoExecucao({}), correto: true, justificativa: "" };
  const relatorio = montarRelatorio([julgado]);
  assert.equal(relatorio.taxaDeAcerto, 1);
});

test("resultadoDeErro marca o item como incorreto e guarda a mensagem do erro", () => {
  const item = criarItem({ id: "item-com-falha" });
  const resultado = resultadoDeErro(item, new Error("Groq nao retornou conteudo na resposta"));

  assert.equal(resultado.correto, false);
  assert.equal(resultado.item.id, "item-com-falha");
  assert.match(resultado.justificativa, /Groq nao retornou conteudo na resposta/);
});

test("resultadoDeErro funciona mesmo quando o erro nao e uma instancia de Error", () => {
  const resultado = resultadoDeErro(criarItem({}), "string de erro qualquer");
  assert.match(resultado.justificativa, /string de erro qualquer/);
});
