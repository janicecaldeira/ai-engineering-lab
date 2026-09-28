import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile, chmod } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { carregarCorpus, listarArquivosDoCorpus } from "./carregar-corpus.js";

let raiz: string;

before(async () => {
  raiz = await mkdtemp(path.join(os.tmpdir(), "rag-lab-corpus-"));

  await mkdir(path.join(raiz, "agents"), { recursive: true });
  await writeFile(path.join(raiz, "agents", "agente-um.md"), "# Agente Um\n\nConteudo real do agente.");
  await writeFile(path.join(raiz, "agents", "agente-vazio.md"), "   \n  \n");
  await writeFile(path.join(raiz, "agents", "nota.txt"), "isso nao e markdown, nao deve entrar");

  await mkdir(path.join(raiz, "skills", "skill-um"), { recursive: true });
  await writeFile(path.join(raiz, "skills", "skill-um", "SKILL.md"), "---\nname: skill-um\n---\n\nConteudo da skill.");

  await mkdir(path.join(raiz, "skills", "skill-sem-arquivo"), { recursive: true });

  await mkdir(path.join(raiz, "skills", "skill-sem-permissao"), { recursive: true });
  const caminhoSemPermissao = path.join(raiz, "skills", "skill-sem-permissao", "SKILL.md");
  await writeFile(caminhoSemPermissao, "conteudo que ninguem vai conseguir ler");
  await chmod(caminhoSemPermissao, 0o000);
});

after(async () => {
  await rm(raiz, { recursive: true, force: true });
});

test("lista agents/*.md e skills/*/SKILL.md, ignora outras extensoes", async () => {
  const arquivos = await listarArquivosDoCorpus(raiz);

  assert.deepEqual(arquivos, [
    "agents/agente-um.md",
    "agents/agente-vazio.md",
    "skills/skill-sem-arquivo/SKILL.md",
    "skills/skill-sem-permissao/SKILL.md",
    "skills/skill-um/SKILL.md",
  ]);
});

test("raiz inexistente resulta em lista vazia, sem lancar erro", async () => {
  const arquivos = await listarArquivosDoCorpus(path.join(raiz, "nao-existe"));
  assert.deepEqual(arquivos, []);
});

test("carregarCorpus separa documentos validos de arquivos pulados", async () => {
  const resultado = await carregarCorpus(raiz);

  assert.equal(resultado.documentos.length, 2);
  const caminhosCarregados = resultado.documentos.map((documento) => documento.caminhoRelativo).sort();
  assert.deepEqual(caminhosCarregados, ["agents/agente-um.md", "skills/skill-um/SKILL.md"]);

  const documentoAgente = resultado.documentos.find((d) => d.caminhoRelativo === "agents/agente-um.md");
  assert.equal(documentoAgente?.conteudo, "# Agente Um\n\nConteudo real do agente.");
  assert.equal(documentoAgente?.caminhoAbsoluto, path.join(raiz, "agents", "agente-um.md"));
});

test("arquivo vazio (so espaco em branco) e reportado e pulado", async () => {
  const resultado = await carregarCorpus(raiz);
  const pulado = resultado.pulados.find((p) => p.caminho === "agents/agente-vazio.md");

  assert.ok(pulado, "arquivo vazio deveria estar na lista de pulados");
  assert.equal(pulado?.motivo, "arquivo vazio");
});

test("skill sem SKILL.md e reportada e pulada, sem derrubar o processo", async () => {
  const resultado = await carregarCorpus(raiz);
  const pulado = resultado.pulados.find((p) => p.caminho === "skills/skill-sem-arquivo/SKILL.md");

  assert.ok(pulado, "SKILL.md ausente deveria estar na lista de pulados");
  assert.match(pulado!.motivo, /nao foi possivel ler o arquivo/);
});

test("arquivo sem permissao de leitura e reportado e pulado, sem derrubar o processo", async () => {
  const resultado = await carregarCorpus(raiz);
  const pulado = resultado.pulados.find((p) => p.caminho === "skills/skill-sem-permissao/SKILL.md");

  assert.ok(pulado, "arquivo sem permissao deveria estar na lista de pulados");
  assert.match(pulado!.motivo, /nao foi possivel ler o arquivo/);
});

test("carregarCorpus nunca lanca erro para raiz inexistente", async () => {
  const resultado = await carregarCorpus(path.join(raiz, "nao-existe"));
  assert.deepEqual(resultado, { documentos: [], pulados: [] });
});
