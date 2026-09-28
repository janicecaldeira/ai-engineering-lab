import path from "node:path";

export interface Config {
  corpusDir: string;
}

const CORPUS_DIR_PADRAO = "../agent-skills/plugins/equipe-dev";

export function carregarConfig(): Config {
  const corpusDirConfigurado = process.env.CORPUS_DIR ?? CORPUS_DIR_PADRAO;
  return {
    corpusDir: path.resolve(process.cwd(), corpusDirConfigurado),
  };
}
