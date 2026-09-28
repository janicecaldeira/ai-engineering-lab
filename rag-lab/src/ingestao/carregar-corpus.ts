import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { ArquivoPulado, DocumentoFonte } from "../tipos.js";

export interface ResultadoCarregamento {
  documentos: DocumentoFonte[];
  pulados: ArquivoPulado[];
}

export async function listarArquivosDoCorpus(raiz: string): Promise<string[]> {
  const [arquivosAgentes, arquivosSkills] = await Promise.all([
    listarArquivosDeAgentes(raiz),
    listarArquivosDeSkills(raiz),
  ]);
  return [...arquivosAgentes, ...arquivosSkills].sort();
}

export async function carregarCorpus(raiz: string): Promise<ResultadoCarregamento> {
  const caminhosRelativos = await listarArquivosDoCorpus(raiz);
  const documentos: DocumentoFonte[] = [];
  const pulados: ArquivoPulado[] = [];

  for (const caminhoRelativo of caminhosRelativos) {
    const caminhoAbsoluto = path.join(raiz, caminhoRelativo);
    const leitura = await lerArquivo(caminhoAbsoluto);

    if (!leitura.ok) {
      pulados.push({ caminho: caminhoRelativo, motivo: leitura.motivo });
      continue;
    }

    if (leitura.conteudo.trim().length === 0) {
      pulados.push({ caminho: caminhoRelativo, motivo: "arquivo vazio" });
      continue;
    }

    documentos.push({
      caminhoRelativo,
      caminhoAbsoluto,
      conteudo: leitura.conteudo,
    });
  }

  return { documentos, pulados };
}

async function listarArquivosDeAgentes(raiz: string): Promise<string[]> {
  const diretorio = path.join(raiz, "agents");
  const entradas = await lerDiretorio(diretorio);
  return entradas
    .filter((entrada) => entrada.isFile() && entrada.name.endsWith(".md"))
    .map((entrada) => path.join("agents", entrada.name));
}

async function listarArquivosDeSkills(raiz: string): Promise<string[]> {
  const diretorio = path.join(raiz, "skills");
  const entradas = await lerDiretorio(diretorio);
  return entradas
    .filter((entrada) => entrada.isDirectory())
    .map((entrada) => path.join("skills", entrada.name, "SKILL.md"));
}

async function lerDiretorio(diretorio: string) {
  try {
    return await readdir(diretorio, { withFileTypes: true });
  } catch {
    return [];
  }
}

type ResultadoLeitura =
  | { ok: true; conteudo: string }
  | { ok: false; motivo: string };

async function lerArquivo(caminhoAbsoluto: string): Promise<ResultadoLeitura> {
  try {
    const conteudo = await readFile(caminhoAbsoluto, "utf8");
    return { ok: true, conteudo };
  } catch (erro) {
    return { ok: false, motivo: `nao foi possivel ler o arquivo: ${mensagemDeErro(erro)}` };
  }
}

function mensagemDeErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro);
}
