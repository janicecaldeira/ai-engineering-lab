---
name: checklist-entrega
description: Verificação final antes de entregar um projeto ou desafio técnico — matriz de requisitos com evidência real, docker compose limpo, suíte de testes, lint, README executável, segredos fora do git e histórico de commits coerente — com veredito go/no-go.
disable-model-invocation: true
argument-hint: [caminho da matriz de requisitos, opcional]
---

Verifique a entrega em `$ARGUMENTS` (se vazio, `docs/matriz-requisitos.md` e o projeto
atual). Nada aqui é "deve funcionar": cada linha tem saída de comando.

Rode em paralelo (Agent tool), cada um em contexto limpo:

- `equipe-dev:hefesto`: `docker compose down -v && docker compose up --build` numa
  cópia limpa (ou `git stash` + `git clean -n` para conferir o que não está versionado);
  health `live`/`ready`; `SIGTERM` com job em andamento; CI verde no último commit.
- `equipe-dev:argos`: `npm run lint` sem violação; suíte unitária e e2e com a saída;
  matriz de requisitos — para cada item, a evidência existe? (nome do teste, comando,
  seção). Marca `atendido` / `parcial` / `ausente`.
- `equipe-dev:hermes`: cada comando do README executado; cada decisão crítica
  justificada; diagramas presentes; "o que faria diferente" honesto; Swagger abre.

Depois, você mesmo:

- `git log --oneline` — commits incrementais e coerentes com a entrega; nenhum "wip"
  final gigante. `git log -p | grep -iE "secret|password|token" ` para segredo vazado;
  `.env` ausente do índice (`git ls-files | grep -E '^\.env$'` vazio).
- Diferenciais: tabela do que foi feito × não feito, com o motivo.

Entregue o veredito:

```
| Item | Tipo | Evidência | Status |
...
Go / No-go: <decisão> — <o que bloqueia, se houver, em ordem de esforço>
```

Não corrija nada silenciosamente: liste, e pergunte o que atacar primeiro.
