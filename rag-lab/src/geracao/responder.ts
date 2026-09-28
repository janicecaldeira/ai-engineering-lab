import Groq from "groq-sdk";
import type { ResultadoBusca } from "../retrieval/buscar.js";

export const MODELO_GERACAO = "openai/gpt-oss-20b";

export const MENSAGEM_SEM_CONTEXTO =
  "não encontrei contexto suficiente para responder com confiança.";

let cliente: Groq | undefined;

function obterCliente(): Groq {
  if (!cliente) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("GROQ_API_KEY nao configurada");
    }
    cliente = new Groq({ apiKey });
  }
  return cliente;
}

export function montarPrompt(pergunta: string, contexto: ResultadoBusca[]): string {
  const blocos = contexto
    .map((chunk, posicao) => `[Fonte ${posicao + 1}: ${chunk.arquivoOrigem}]\n${chunk.texto}`)
    .join("\n\n");

  return [
    "Responda a pergunta usando apenas as fontes de contexto abaixo.",
    `Se o contexto nao for suficiente para responder com confianca, responda exatamente: "${MENSAGEM_SEM_CONTEXTO}"`,
    "Nunca invente informacao que nao esteja no contexto.",
    "",
    "Contexto:",
    blocos,
    "",
    `Pergunta: ${pergunta}`,
  ].join("\n");
}

export function respostaIndicaRecusa(resposta: string): boolean {
  return resposta.toLowerCase().includes(MENSAGEM_SEM_CONTEXTO.toLowerCase());
}

export async function gerarResposta(pergunta: string, contexto: ResultadoBusca[]): Promise<string> {
  const prompt = montarPrompt(pergunta, contexto);
  const completude = await obterCliente().chat.completions.create({
    model: MODELO_GERACAO,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.1,
    reasoning_effort: "low",
  });

  const resposta = completude.choices[0]?.message?.content;
  if (!resposta) {
    throw new Error("Groq nao retornou conteudo na resposta");
  }
  return resposta;
}
