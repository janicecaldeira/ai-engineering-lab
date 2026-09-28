import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { obterPool } from "../../rag-lab/src/db/cliente.js";
import { carregarConfig } from "./config/env.js";
import { criarServidor } from "./servidor.js";
import { criarDependenciasPadrao as criarDependenciasBuscarChunks } from "./tools/buscar-chunks.js";
import { criarDependenciasPadrao as criarDependenciasPerguntarCorpus } from "./tools/perguntar-corpus.js";
import { criarDependenciasPadrao as criarDependenciasArquivosIndexados } from "./resources/arquivos-indexados.js";

async function main() {
  carregarConfig();

  const pool = obterPool();
  const servidor = criarServidor({
    buscarChunks: criarDependenciasBuscarChunks(pool),
    perguntarCorpus: criarDependenciasPerguntarCorpus(pool),
    arquivosIndexados: criarDependenciasArquivosIndexados(pool),
  });
  const transporte = new StdioServerTransport();
  await servidor.connect(transporte);
}

main().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
