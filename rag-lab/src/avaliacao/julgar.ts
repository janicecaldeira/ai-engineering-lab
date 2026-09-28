import Groq from "groq-sdk";

export const MODELO_JULGAMENTO = "openai/gpt-oss-20b";

export interface Julgamento {
  correto: boolean;
  justificativa: string;
}

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

export function montarPromptJulgamento(
  pergunta: string,
  respostaEsperada: string,
  respostaObtida: string,
): string {
  return [
    "Voce e um avaliador de respostas de um sistema de perguntas e respostas.",
    "Compare a resposta obtida com a resposta esperada e diga se ela esta correta.",
    "A resposta obtida nao precisa ser identica: considere correta se cobre a mesma",
    "informacao central da resposta esperada, mesmo com palavras diferentes.",
    'Responda em JSON com exatamente estas chaves: "correto" (boolean) e',
    '"justificativa" (string curta).',
    "",
    `Pergunta: ${pergunta}`,
    `Resposta esperada: ${respostaEsperada}`,
    `Resposta obtida: ${respostaObtida}`,
  ].join("\n");
}

export function interpretarJulgamento(conteudo: string): Julgamento {
  let dados: unknown;
  try {
    dados = JSON.parse(conteudo);
  } catch {
    return { correto: false, justificativa: `juiz nao retornou JSON valido: ${conteudo}` };
  }

  if (typeof dados !== "object" || dados === null) {
    return { correto: false, justificativa: `juiz nao retornou um objeto JSON: ${conteudo}` };
  }

  const registro = dados as Record<string, unknown>;
  if (typeof registro.correto !== "boolean") {
    return { correto: false, justificativa: `campo "correto" ausente ou invalido: ${conteudo}` };
  }

  return {
    correto: registro.correto,
    justificativa: typeof registro.justificativa === "string" ? registro.justificativa : "",
  };
}

export async function julgarComLLM(
  pergunta: string,
  respostaEsperada: string,
  respostaObtida: string,
): Promise<Julgamento> {
  const prompt = montarPromptJulgamento(pergunta, respostaEsperada, respostaObtida);
  const completude = await obterCliente().chat.completions.create({
    model: MODELO_JULGAMENTO,
    messages: [{ role: "user", content: prompt }],
    temperature: 0,
    reasoning_effort: "low",
    response_format: { type: "json_object" },
  });

  const conteudo = completude.choices[0]?.message?.content;
  if (!conteudo) {
    return { correto: false, justificativa: "juiz nao retornou conteudo" };
  }

  return interpretarJulgamento(conteudo);
}
