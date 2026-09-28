export interface DocumentoFonte {
  caminhoRelativo: string;
  caminhoAbsoluto: string;
  conteudo: string;
}

export interface ArquivoPulado {
  caminho: string;
  motivo: string;
}

export interface OpcoesChunking {
  tamanhoMaximo: number;
  sobreposicao: number;
}

export interface Chunk {
  arquivoOrigem: string;
  indice: number;
  offsetInicio: number;
  offsetFim: number;
  texto: string;
}

export type CategoriaAvaliacao = "relevante" | "fora-do-corpus";

export interface ItemAvaliacao {
  id: string;
  pergunta: string;
  categoria: CategoriaAvaliacao;
  respostaEsperada: string | null;
  fonteEsperada: string | null;
}
