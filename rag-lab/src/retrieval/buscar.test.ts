import assert from "node:assert/strict";
import { test } from "node:test";
import { contextoSuficiente, LIMIAR_DISTANCIA_MAXIMA } from "./buscar.js";
import type { ResultadoBusca } from "./buscar.js";

function criarResultado(distancia: number): ResultadoBusca {
  return {
    id: 1,
    arquivoOrigem: "agents/exemplo.md",
    indice: 0,
    texto: "texto de exemplo",
    distancia,
  };
}

test("sem resultados, contexto nunca e suficiente", () => {
  assert.equal(contextoSuficiente([]), false);
});

test("melhor distancia dentro do limiar padrao e suficiente", () => {
  const resultados = [criarResultado(0.42), criarResultado(0.55)];
  assert.equal(contextoSuficiente(resultados), true);
});

test("melhor distancia acima do limiar padrao nao e suficiente", () => {
  const resultados = [criarResultado(0.9), criarResultado(0.95)];
  assert.equal(contextoSuficiente(resultados), false);
});

test("distancia exatamente no limiar conta como suficiente", () => {
  const resultados = [criarResultado(LIMIAR_DISTANCIA_MAXIMA)];
  assert.equal(contextoSuficiente(resultados), true);
});

test("so o melhor resultado importa, mesmo com os outros ruins", () => {
  const resultados = [criarResultado(0.3), criarResultado(0.99), criarResultado(0.99)];
  assert.equal(contextoSuficiente(resultados), true);
});

test("limiar customizado sobrescreve o padrao", () => {
  const resultados = [criarResultado(0.5)];
  assert.equal(contextoSuficiente(resultados, 0.4), false);
  assert.equal(contextoSuficiente(resultados, 0.6), true);
});
