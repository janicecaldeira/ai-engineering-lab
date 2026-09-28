import type { Pool } from "pg";
import type { ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";

export const NOME_RESOURCE_ARQUIVOS_INDEXADOS = "arquivos_indexados";
export const URI_RESOURCE_ARQUIVOS_INDEXADOS = "corpus://arquivos-indexados";

export interface ArquivoIndexado {
  arquivoOrigem: string;
  contagemChunks: number;
}

export interface DependenciasArquivosIndexados {
  listarArquivos: () => Promise<ArquivoIndexado[]>;
}

export function criarDependenciasPadrao(pool: Pool): DependenciasArquivosIndexados {
  return {
    listarArquivos: () => listarArquivosNoPostgres(pool),
  };
}

async function listarArquivosNoPostgres(pool: Pool): Promise<ArquivoIndexado[]> {
  const resultado = await pool.query<{ arquivo_origem: string; contagem: number }>(
    "SELECT arquivo_origem, COUNT(*)::int AS contagem FROM chunks GROUP BY arquivo_origem ORDER BY arquivo_origem",
  );

  return resultado.rows.map((linha) => ({
    arquivoOrigem: linha.arquivo_origem,
    contagemChunks: linha.contagem,
  }));
}

export async function arquivosIndexadosHandler(
  deps: DependenciasArquivosIndexados,
  uri: URL,
): Promise<ReadResourceResult> {
  const arquivos = await deps.listarArquivos();

  return {
    contents: [
      {
        uri: uri.toString(),
        mimeType: "application/json",
        text: JSON.stringify(arquivos, null, 2),
      },
    ],
  };
}
