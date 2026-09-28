import { pipeline } from "@huggingface/transformers";
import type { FeatureExtractionPipeline } from "@huggingface/transformers";

export const MODELO_EMBEDDING = "onnx-community/all-MiniLM-L6-v2-ONNX";
export const DIMENSOES_EMBEDDING = 384;

let extratorPromise: Promise<FeatureExtractionPipeline> | undefined;

function obterExtrator(): Promise<FeatureExtractionPipeline> {
  extratorPromise ??= pipeline("feature-extraction", MODELO_EMBEDDING);
  return extratorPromise;
}

export async function gerarEmbedding(texto: string): Promise<number[]> {
  const extrator = await obterExtrator();
  const saida = await extrator(texto, { pooling: "mean", normalize: true });
  const [vetor] = saida.tolist() as number[][];
  if (!vetor) {
    throw new Error("modelo de embedding nao retornou nenhum vetor");
  }
  return vetor;
}
