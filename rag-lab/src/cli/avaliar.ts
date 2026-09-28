import { encerrarPool, obterPool } from "../db/cliente.js";
import { avaliarDataset } from "../avaliacao/avaliar.js";
import { carregarDataset } from "../avaliacao/dataset.js";

async function main() {
  const itens = await carregarDataset();
  console.log(`dataset: ${itens.length} perguntas`);

  const pool = obterPool();
  try {
    const relatorio = await avaliarDataset(pool, itens);

    for (const resultado of relatorio.resultados) {
      const status = resultado.correto ? "OK " : "FALHOU";
      const recusaTag = resultado.recusou ? " [recusou]" : "";
      console.log(`\n[${status}]${recusaTag} ${resultado.item.id} (${resultado.item.categoria})`);
      console.log(`  pergunta: ${resultado.item.pergunta}`);
      if (resultado.distanciaMelhorChunk !== null) {
        console.log(`  distancia do melhor chunk: ${resultado.distanciaMelhorChunk.toFixed(4)}`);
      }
      if (resultado.resposta) {
        console.log(`  resposta: ${resultado.resposta}`);
      }
      if (resultado.fontes.length > 0) {
        console.log(`  fontes: ${resultado.fontes.join(", ")}`);
      }
      console.log(`  julgamento: ${resultado.justificativa}`);
    }

    const percentual = (relatorio.taxaDeAcerto * 100).toFixed(1);
    console.log(`\ntaxa de acerto: ${relatorio.totalCorretos}/${relatorio.totalItens} (${percentual}%)`);
  } finally {
    await encerrarPool();
  }
}

main().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
