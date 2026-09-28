import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CategoriaAvaliacao, ItemAvaliacao } from "../tipos.js";

const diretorioAtual = path.dirname(fileURLToPath(import.meta.url));
const CAMINHO_DATASET_PADRAO = path.join(diretorioAtual, "dataset.json");

const CATEGORIAS_VALIDAS: CategoriaAvaliacao[] = ["relevante", "fora-do-corpus"];

export async function carregarDataset(caminho: string = CAMINHO_DATASET_PADRAO): Promise<ItemAvaliacao[]> {
  const conteudo = await readFile(caminho, "utf8");
  return interpretarDataset(conteudo);
}

export function interpretarDataset(conteudoJson: string): ItemAvaliacao[] {
  const dados: unknown = JSON.parse(conteudoJson);
  if (!Array.isArray(dados)) {
    throw new Error("dataset de avaliacao precisa ser uma lista");
  }
  return dados.map((item, posicao) => validarItem(item, posicao));
}

function validarItem(item: unknown, posicao: number): ItemAvaliacao {
  if (typeof item !== "object" || item === null) {
    throw new Error(`item ${posicao} do dataset nao e um objeto`);
  }

  const registro = item as Record<string, unknown>;

  if (typeof registro.id !== "string" || registro.id.length === 0) {
    throw new Error(`item ${posicao} do dataset esta sem "id" valido`);
  }
  if (typeof registro.pergunta !== "string" || registro.pergunta.length === 0) {
    throw new Error(`item "${registro.id}" esta sem "pergunta" valida`);
  }
  if (!CATEGORIAS_VALIDAS.includes(registro.categoria as CategoriaAvaliacao)) {
    throw new Error(`item "${registro.id}" tem categoria invalida: ${String(registro.categoria)}`);
  }
  if (registro.respostaEsperada !== null && typeof registro.respostaEsperada !== "string") {
    throw new Error(`item "${registro.id}" tem "respostaEsperada" invalida`);
  }
  if (registro.fonteEsperada !== null && typeof registro.fonteEsperada !== "string") {
    throw new Error(`item "${registro.id}" tem "fonteEsperada" invalida`);
  }

  return {
    id: registro.id,
    pergunta: registro.pergunta,
    categoria: registro.categoria as CategoriaAvaliacao,
    respostaEsperada: registro.respostaEsperada as string | null,
    fonteEsperada: registro.fonteEsperada as string | null,
  };
}
