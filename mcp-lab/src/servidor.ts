import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  NOME_TOOL_BUSCAR_CHUNKS,
  schemaEntradaBuscarChunks,
  schemaSaidaBuscarChunks,
  buscarChunksHandler,
  type DependenciasBuscarChunks,
} from "./tools/buscar-chunks.js";
import {
  NOME_TOOL_PERGUNTAR_CORPUS,
  schemaEntradaPerguntarCorpus,
  schemaSaidaPerguntarCorpus,
  perguntarCorpusHandler,
  type DependenciasPerguntarCorpus,
} from "./tools/perguntar-corpus.js";
import {
  NOME_RESOURCE_ARQUIVOS_INDEXADOS,
  URI_RESOURCE_ARQUIVOS_INDEXADOS,
  arquivosIndexadosHandler,
  type DependenciasArquivosIndexados,
} from "./resources/arquivos-indexados.js";
import {
  NOME_PROMPT_NOVA_PERGUNTA_AVALIACAO,
  schemaArgumentosNovaPerguntaAvaliacao,
  novaPerguntaAvaliacaoHandler,
} from "./prompts/nova-pergunta-avaliacao.js";

export const NOME_SERVIDOR = "mcp-lab";
export const VERSAO_SERVIDOR = "0.1.0";

export interface DependenciasServidor {
  buscarChunks: DependenciasBuscarChunks;
  perguntarCorpus: DependenciasPerguntarCorpus;
  arquivosIndexados: DependenciasArquivosIndexados;
}

export function criarServidor(deps: DependenciasServidor): McpServer {
  const servidor = new McpServer({
    name: NOME_SERVIDOR,
    version: VERSAO_SERVIDOR,
  });

  servidor.registerTool(
    NOME_TOOL_BUSCAR_CHUNKS,
    {
      title: "Buscar chunks",
      description:
        "Busca semantica pura no corpus indexado do rag-lab, sem geracao via Groq: devolve os chunks mais proximos por similaridade de cosseno, com arquivo de origem, posicao e distancia.",
      inputSchema: schemaEntradaBuscarChunks,
      outputSchema: schemaSaidaBuscarChunks,
    },
    (args) => buscarChunksHandler(deps.buscarChunks, args),
  );

  servidor.registerTool(
    NOME_TOOL_PERGUNTAR_CORPUS,
    {
      title: "Perguntar ao corpus",
      description:
        "Responde uma pergunta em linguagem natural usando o pipeline de retrieval + geracao (Groq) do rag-lab: devolve a resposta e os arquivos de origem usados como contexto. Recusa quando o contexto recuperado nao e suficiente, sem inventar.",
      inputSchema: schemaEntradaPerguntarCorpus,
      outputSchema: schemaSaidaPerguntarCorpus,
    },
    (args) => perguntarCorpusHandler(deps.perguntarCorpus, args),
  );

  servidor.registerResource(
    NOME_RESOURCE_ARQUIVOS_INDEXADOS,
    URI_RESOURCE_ARQUIVOS_INDEXADOS,
    {
      title: "Arquivos indexados",
      description:
        "Lista os arquivos indexados no corpus do rag-lab, com a contagem de chunks de cada um. Carregado pela aplicacao, nao invocado pelo modelo.",
      mimeType: "application/json",
    },
    (uri) => arquivosIndexadosHandler(deps.arquivosIndexados, uri),
  );

  servidor.registerPrompt(
    NOME_PROMPT_NOVA_PERGUNTA_AVALIACAO,
    {
      title: "Nova pergunta de avaliação",
      description:
        "Gera um template de pergunta + resposta esperada no formato do dataset de avaliação do rag-lab, para o usuario revisar e adicionar em dataset.json.",
      argsSchema: schemaArgumentosNovaPerguntaAvaliacao,
    },
    (args) => novaPerguntaAvaliacaoHandler(args),
  );

  return servidor;
}
