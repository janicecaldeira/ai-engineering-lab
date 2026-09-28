import assert from "node:assert/strict";
import { test } from "node:test";
import { novaPerguntaAvaliacaoHandler } from "./nova-pergunta-avaliacao.js";

function textoDaPrimeiraMensagem(resultado: ReturnType<typeof novaPerguntaAvaliacaoHandler>): string {
  const mensagem = resultado.messages[0];
  assert.equal(mensagem?.role, "user");
  assert.equal(mensagem?.content.type, "text");
  return (mensagem?.content as { text: string }).text;
}

test("sem tema, gera instrucao generica no formato do dataset", () => {
  const resultado = novaPerguntaAvaliacaoHandler({});
  const texto = textoDaPrimeiraMensagem(resultado);

  assert.match(texto, /Gere uma nova pergunta de avaliação para o dataset do rag-lab/);
  assert.match(texto, /"categoria"/);
  assert.match(texto, /"respostaEsperada"/);
  assert.match(texto, /"fonteEsperada"/);
  assert.match(texto, /relevante/);
  assert.match(texto, /fora-do-corpus/);
});

test("com tema, inclui o tema na instrucao", () => {
  const resultado = novaPerguntaAvaliacaoHandler({ tema: "idempotência" });
  const texto = textoDaPrimeiraMensagem(resultado);

  assert.match(texto, /sobre "idempotência"/);
});

test("devolve description e uma unica mensagem de usuario", () => {
  const resultado = novaPerguntaAvaliacaoHandler({});

  assert.equal(typeof resultado.description, "string");
  assert.equal(resultado.messages.length, 1);
});
