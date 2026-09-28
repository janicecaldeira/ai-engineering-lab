import type { Chunk, DocumentoFonte, OpcoesChunking } from "../tipos.js";

export const OPCOES_CHUNKING_PADRAO: OpcoesChunking = {
  tamanhoMaximo: 800,
  sobreposicao: 120,
};

type FragmentoChunk = Omit<Chunk, "arquivoOrigem">;

export function dividirTextoEmChunks(
  texto: string,
  opcoes: OpcoesChunking = OPCOES_CHUNKING_PADRAO,
): FragmentoChunk[] {
  validarOpcoes(opcoes);

  if (texto.length === 0) {
    return [];
  }

  const avanco = opcoes.tamanhoMaximo - opcoes.sobreposicao;
  const fragmentos: FragmentoChunk[] = [];

  let indice = 0;
  let offsetInicio = 0;
  while (offsetInicio < texto.length) {
    const offsetFim = Math.min(offsetInicio + opcoes.tamanhoMaximo, texto.length);
    fragmentos.push({
      indice,
      offsetInicio,
      offsetFim,
      texto: texto.slice(offsetInicio, offsetFim),
    });

    if (offsetFim >= texto.length) {
      break;
    }

    offsetInicio += avanco;
    indice += 1;
  }

  return fragmentos;
}

export function chunkarDocumento(
  documento: DocumentoFonte,
  opcoes: OpcoesChunking = OPCOES_CHUNKING_PADRAO,
): Chunk[] {
  return dividirTextoEmChunks(documento.conteudo, opcoes).map((fragmento) => ({
    ...fragmento,
    arquivoOrigem: documento.caminhoRelativo,
  }));
}

function validarOpcoes(opcoes: OpcoesChunking): void {
  if (opcoes.tamanhoMaximo <= 0) {
    throw new Error("tamanhoMaximo precisa ser maior que zero");
  }
  if (opcoes.sobreposicao < 0) {
    throw new Error("sobreposicao nao pode ser negativa");
  }
  if (opcoes.sobreposicao >= opcoes.tamanhoMaximo) {
    throw new Error("sobreposicao precisa ser menor que tamanhoMaximo");
  }
}
