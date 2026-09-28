---
name: commit
description: Prepara um commit incremental e coerente — agrupa as mudanças relacionadas, propõe mensagem em Conventional Commits explicando o porquê, confere que nenhum segredo entra e só comete com confirmação explícita. Nunca faz push.
argument-hint: [escopo ou intenção, opcional]
---

Prepare um commit para: **$ARGUMENTS** (se vazio, as mudanças atuais).

1. `git status --short` e `git diff` (staged e unstaged). Se as mudanças contêm mais de
   uma intenção (ex.: migration + endpoint + README), proponha **dividir** em commits
   sequenciais, um por passo do blueprint — histórico incremental vale ponto.
2. Confira: nenhum `.env`, chave, token ou dump no diff; **nenhum comentário ou JSDoc
   novo no código** (`git diff -U0 | grep '^+' | grep -E '//|/\*|^\+\s*#'` — só diretivas
   de ferramenta passam; explicação vai para a mensagem do commit); nenhum arquivo gerado que não
   deveria estar versionado; lint passa nos arquivos tocados.
3. Proponha a mensagem: `tipo(escopo): resumo no imperativo` + corpo curto com o
   **porquê** (não o que — o diff já diz o quê). Tipos: feat, fix, refactor, test, docs,
   chore, ci, build.
4. Mostre à Janice: arquivos que entram, mensagem proposta. Confirme com
   `AskUserQuestion` (cometer / editar mensagem / dividir / cancelar). Se ela **já
   autorizou este commit** na mesma conversa (ex.: respondeu "commitar" na parada do
   `/equipe-dev:feature`), não pergunte de novo: mostre a mensagem e comete.
5. Só com confirmação: `git add <arquivos listados>` e `git commit -m ...`. Sem
   `--no-verify`. Termine a mensagem com a linha de atribuição que a sessão indicar
   (`Co-Authored-By: ...`), se houver. **Nunca `git push`** — isso é dela.
