import { obterPool, encerrarPool } from "../db/cliente.js";
import { gerarEmbedding } from "../embedding/gerar-embedding.js";
import { gerarResposta, MENSAGEM_SEM_CONTEXTO } from "../geracao/responder.js";
import { buscarChunksSimilares, contextoSuficiente } from "../retrieval/buscar.js";

async function main() {
  const pergunta = process.argv.slice(2).join(" ").trim();
  if (!pergunta) {
    console.error('uso: npm run perguntar -- "sua pergunta"');
    process.exitCode = 1;
    return;
  }

  const pool = obterPool();
  try {
    const embeddingPergunta = await gerarEmbedding(pergunta);
    const resultados = await buscarChunksSimilares(pool, embeddingPergunta);

    console.log(`pergunta: ${pergunta}`);
    console.log("chunks recuperados:");
    for (const resultado of resultados) {
      console.log(`  distancia=${resultado.distancia.toFixed(4)}  ${resultado.arquivoOrigem}#${resultado.indice}`);
    }

    if (!contextoSuficiente(resultados)) {
      console.log(`\n${MENSAGEM_SEM_CONTEXTO}`);
      return;
    }

    const resposta = await gerarResposta(pergunta, resultados);
    console.log(`\nresposta:\n${resposta}`);

    const fontes = [...new Set(resultados.map((resultado) => resultado.arquivoOrigem))];
    console.log("\nfontes:");
    for (const fonte of fontes) {
      console.log(`  - ${fonte}`);
    }
  } finally {
    await encerrarPool();
  }
}

main().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
