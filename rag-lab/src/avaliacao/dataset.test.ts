import assert from "node:assert/strict";
import { test } from "node:test";
import { interpretarDataset } from "./dataset.js";

test("interpreta um dataset valido com as duas categorias", () => {
  const json = JSON.stringify([
    {
      id: "q1",
      pergunta: "pergunta relevante",
      categoria: "relevante",
      respostaEsperada: "resposta esperada",
      fonteEsperada: "agents/dedalo.md",
    },
    {
      id: "q2",
      pergunta: "pergunta fora do corpus",
      categoria: "fora-do-corpus",
      respostaEsperada: null,
      fonteEsperada: null,
    },
  ]);

  const itens = interpretarDataset(json);

  assert.equal(itens.length, 2);
  assert.equal(itens[0]?.categoria, "relevante");
  assert.equal(itens[1]?.respostaEsperada, null);
});

test("rejeita dataset que nao e uma lista", () => {
  assert.throws(() => interpretarDataset(JSON.stringify({ nao: "e lista" })));
});

test("rejeita item sem pergunta", () => {
  const json = JSON.stringify([{ id: "q1", categoria: "relevante", respostaEsperada: null, fonteEsperada: null }]);
  assert.throws(() => interpretarDataset(json));
});

test("rejeita item com categoria invalida", () => {
  const json = JSON.stringify([
    { id: "q1", pergunta: "x", categoria: "categoria-que-nao-existe", respostaEsperada: null, fonteEsperada: null },
  ]);
  assert.throws(() => interpretarDataset(json));
});

test("rejeita item com id vazio", () => {
  const json = JSON.stringify([
    { id: "", pergunta: "x", categoria: "relevante", respostaEsperada: "y", fonteEsperada: "z.md" },
  ]);
  assert.throws(() => interpretarDataset(json));
});

test("dataset real do projeto carrega sem erro e tem entre 10 e 20 itens", async () => {
  const { carregarDataset } = await import("./dataset.js");
  const itens = await carregarDataset();

  assert.ok(itens.length >= 10 && itens.length <= 20, `esperava 10-20 itens, tem ${itens.length}`);
  const categorias = new Set(itens.map((item) => item.categoria));
  assert.ok(categorias.has("relevante"));
  assert.ok(categorias.has("fora-do-corpus"));
});
