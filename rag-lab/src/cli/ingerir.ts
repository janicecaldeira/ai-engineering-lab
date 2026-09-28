import { carregarConfig } from "../config/env.js";
import { obterPool, encerrarPool } from "../db/cliente.js";
import { gerarEmbedding } from "../embedding/gerar-embedding.js";
import { carregarCorpus } from "../ingestao/carregar-corpus.js";
import { chunkarDocumento } from "../ingestao/chunking.js";
import { indexarChunks } from "../indexacao/indexar.js";
import { aplicarSchema } from "../indexacao/schema.js";
import type { ChunkComEmbedding } from "../indexacao/indexar.js";

async function main() {
  const config = carregarConfig();
  const { documentos, pulados } = await carregarCorpus(config.corpusDir);
  const chunks = documentos.flatMap((documento) => chunkarDocumento(documento));

  console.log(`corpus: ${config.corpusDir}`);
  console.log(`arquivos lidos: ${documentos.length}`);
  console.log(`arquivos pulados: ${pulados.length}`);
  for (const pulado of pulados) {
    console.log(`  - ${pulado.caminho}: ${pulado.motivo}`);
  }
  console.log(`chunks gerados: ${chunks.length}`);

  console.log("gerando embeddings...");
  const itens: ChunkComEmbedding[] = [];
  for (const [posicao, chunk] of chunks.entries()) {
    const embedding = await gerarEmbedding(chunk.texto);
    itens.push({ chunk, embedding });
    if ((posicao + 1) % 20 === 0 || posicao + 1 === chunks.length) {
      console.log(`  ${posicao + 1}/${chunks.length}`);
    }
  }

  const pool = obterPool();
  try {
    await aplicarSchema(pool);
    const quantidadeIndexada = await indexarChunks(pool, itens);
    console.log(`chunks indexados no Postgres: ${quantidadeIndexada}`);
  } finally {
    await encerrarPool();
  }
}

main().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
