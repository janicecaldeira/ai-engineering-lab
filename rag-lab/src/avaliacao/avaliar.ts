import type { Pool } from "pg";
import { gerarEmbedding } from "../embedding/gerar-embedding.js";
import { gerarResposta, respostaIndicaRecusa } from "../geracao/responder.js";
import { buscarChunksSimilares, contextoSuficiente } from "../retrieval/buscar.js";
import type { ItemAvaliacao } from "../tipos.js";
import { julgarComLLM } from "./julgar.js";

export interface ResultadoExecucao {
  item: ItemAvaliacao;
  recusou: boolean;
  resposta: string | null;
  fontes: string[];
  distanciaMelhorChunk: number | null;
}

export interface ResultadoJulgado extends ResultadoExecucao {
  correto: boolean;
  justificativa: string;
}

export async function executarItem(pool: Pool, item: ItemAvaliacao): Promise<ResultadoExecucao> {
  const embeddingPergunta = await gerarEmbedding(item.pergunta);
  const resultadosBusca = await buscarChunksSimilares(pool, embeddingPergunta);
  const distanciaMelhorChunk = resultadosBusca[0]?.distancia ?? null;

  if (!contextoSuficiente(resultadosBusca)) {
    return { item, recusou: true, resposta: null, fontes: [], distanciaMelhorChunk };
  }

  const resposta = await gerarResposta(item.pergunta, resultadosBusca);
  const fontes = [...new Set(resultadosBusca.map((resultado) => resultado.arquivoOrigem))];

  return {
    item,
    recusou: respostaIndicaRecusa(resposta),
    resposta,
    fontes,
    distanciaMelhorChunk,
  };
}

export function julgarRecusa(resultado: ResultadoExecucao): ResultadoJulgado {
  const correto = resultado.recusou;
  return {
    ...resultado,
    correto,
    justificativa: correto
      ? "recusou corretamente, pergunta fora do corpus"
      : "deveria ter recusado (fora do corpus) mas respondeu",
  };
}

export async function julgarResultado(resultado: ResultadoExecucao): Promise<ResultadoJulgado> {
  if (resultado.item.categoria === "fora-do-corpus") {
    return julgarRecusa(resultado);
  }

  if (resultado.recusou) {
    return {
      ...resultado,
      correto: false,
      justificativa: "recusou respondendo, mas a pergunta era respondível pelo corpus",
    };
  }

  const julgamento = await julgarComLLM(
    resultado.item.pergunta,
    resultado.item.respostaEsperada ?? "",
    resultado.resposta ?? "",
  );

  return { ...resultado, ...julgamento };
}

export interface RelatorioAvaliacao {
  resultados: ResultadoJulgado[];
  totalItens: number;
  totalCorretos: number;
  taxaDeAcerto: number;
}

export function montarRelatorio(resultados: ResultadoJulgado[]): RelatorioAvaliacao {
  const totalCorretos = resultados.filter((resultado) => resultado.correto).length;
  const totalItens = resultados.length;

  return {
    resultados,
    totalItens,
    totalCorretos,
    taxaDeAcerto: totalItens === 0 ? 0 : totalCorretos / totalItens,
  };
}

export function resultadoDeErro(item: ItemAvaliacao, erro: unknown): ResultadoJulgado {
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  return {
    item,
    recusou: false,
    resposta: null,
    fontes: [],
    distanciaMelhorChunk: null,
    correto: false,
    justificativa: `erro ao executar o item: ${mensagem}`,
  };
}

async function esperar(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export const PAUSA_ENTRE_ITENS_MS = 500;

export async function avaliarDataset(pool: Pool, itens: ItemAvaliacao[]): Promise<RelatorioAvaliacao> {
  const resultados: ResultadoJulgado[] = [];
  for (const [posicao, item] of itens.entries()) {
    try {
      const execucao = await executarItem(pool, item);
      const julgado = await julgarResultado(execucao);
      resultados.push(julgado);
    } catch (erro) {
      resultados.push(resultadoDeErro(item, erro));
    }

    if (posicao < itens.length - 1) {
      await esperar(PAUSA_ENTRE_ITENS_MS);
    }
  }
  return montarRelatorio(resultados);
}
