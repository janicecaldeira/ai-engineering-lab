import { z } from "zod";
import type { GetPromptResult } from "@modelcontextprotocol/sdk/types.js";

export const NOME_PROMPT_NOVA_PERGUNTA_AVALIACAO = "nova_pergunta_avaliacao";

export const schemaArgumentosNovaPerguntaAvaliacao = {
  tema: z.string().optional(),
};

export type ArgumentosNovaPerguntaAvaliacao = {
  tema?: string | undefined;
};

export function novaPerguntaAvaliacaoHandler(
  argumentos: ArgumentosNovaPerguntaAvaliacao,
): GetPromptResult {
  const foco = argumentos.tema ? ` sobre "${argumentos.tema}"` : "";

  const texto = [
    `Gere uma nova pergunta de avaliação${foco} para o dataset do rag-lab.`,
    "Devolva um objeto JSON no mesmo formato de rag-lab/src/avaliacao/dataset.json:",
    "",
    "{",
    '  "id": "identificador-curto-em-kebab-case",',
    '  "pergunta": "a pergunta em linguagem natural",',
    '  "categoria": "relevante" ou "fora-do-corpus",',
    '  "respostaEsperada": "resposta esperada, ou null quando categoria e fora-do-corpus",',
    '  "fonteEsperada": "caminho do arquivo fonte, ou null quando categoria e fora-do-corpus"',
    "}",
    "",
    'Use "relevante" quando a pergunta puder ser respondida com o corpus do rag-lab',
    "(agents/*.md, skills/*/SKILL.md). Use \"fora-do-corpus\" para uma pergunta que o",
    "corpus claramente nao cobre, com respostaEsperada e fonteEsperada nulos.",
    "Devolva so o objeto, para revisao manual antes de entrar em dataset.json — esta",
    "tool nao escreve no arquivo.",
  ].join("\n");

  return {
    description: "Template para uma nova entrada do dataset de avaliação do rag-lab",
    messages: [
      {
        role: "user",
        content: { type: "text", text: texto },
      },
    ],
  };
}
