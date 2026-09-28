import assert from "node:assert/strict";
import { test } from "node:test";
import { interpretarJulgamento, montarPromptJulgamento } from "./julgar.js";

test("interpreta julgamento valido com correto=true", () => {
  const julgamento = interpretarJulgamento('{"correto": true, "justificativa": "bateu"}');
  assert.deepEqual(julgamento, { correto: true, justificativa: "bateu" });
});

test("interpreta julgamento valido com correto=false", () => {
  const julgamento = interpretarJulgamento('{"correto": false, "justificativa": "nao bateu"}');
  assert.deepEqual(julgamento, { correto: false, justificativa: "nao bateu" });
});

test("JSON invalido vira julgamento incorreto, com o conteudo bruto na justificativa", () => {
  const julgamento = interpretarJulgamento("isso nao e json");
  assert.equal(julgamento.correto, false);
  assert.match(julgamento.justificativa, /nao retornou JSON valido/);
});

test("JSON valido mas sem o campo correto vira julgamento incorreto", () => {
  const julgamento = interpretarJulgamento('{"justificativa": "sem o campo certo"}');
  assert.equal(julgamento.correto, false);
});

test("campo correto com tipo errado vira julgamento incorreto", () => {
  const julgamento = interpretarJulgamento('{"correto": "sim", "justificativa": "string, nao boolean"}');
  assert.equal(julgamento.correto, false);
});

test("justificativa ausente vira string vazia, nao quebra", () => {
  const julgamento = interpretarJulgamento('{"correto": true}');
  assert.deepEqual(julgamento, { correto: true, justificativa: "" });
});

test("prompt de julgamento inclui pergunta e as duas respostas", () => {
  const prompt = montarPromptJulgamento("pergunta x", "resposta esperada y", "resposta obtida z");
  assert.match(prompt, /pergunta x/);
  assert.match(prompt, /resposta esperada y/);
  assert.match(prompt, /resposta obtida z/);
});
