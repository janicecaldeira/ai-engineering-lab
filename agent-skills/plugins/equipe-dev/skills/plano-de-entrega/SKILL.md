---
name: plano-de-entrega
description: Transforma uma especificação ou enunciado de desafio técnico (PDF, markdown ou texto colado) em matriz de rastreabilidade de requisitos, decisões críticas a tomar antes de codar e plano de execução por blocos com checkpoints de commit, dentro do prazo declarado.
disable-model-invocation: true
argument-hint: [caminho do enunciado ou texto]
---

Planeje a entrega de: **$ARGUMENTS**

Copie e marque:

```
- [ ] 1. Ler o enunciado inteiro (todas as páginas)
- [ ] 2. Matriz de rastreabilidade (Atena)
- [ ] 3. Decisões críticas com default (Dédalo, Mnemósine, Hefesto)
- [ ] 4. Plano por blocos com checkpoints de commit
- [ ] 5. Aprovação                                   ← parada
```

**1.** Leia o enunciado completo — se for PDF, todas as páginas. Nada de planejar com
metade do documento.

**2.** Delegue a `equipe-dev:atena` com o texto: matriz de rastreabilidade (uma linha
por "deve/obrigatório/diferencial/critério de avaliação"), com persona dona e evidência
esperada. Grave em `docs/matriz-requisitos.md`.

**3.** Em paralelo (Agent tool), com a matriz em mãos:
- `equipe-dev:dedalo`: as 5–8 decisões de arquitetura que o avaliador declara críticas
  (ordenação, idempotência, fila/retry, tempo real/retomada, cache, auth/webhook), cada
  uma com **default recomendado**, alternativa e custo — para decidir antes de codar.
- `equipe-dev:mnemosine`: rascunho do schema (tabelas, constraints, índices) e a escolha
  de ORM/migrations.
- `equipe-dev:hefesto`: baseline de infra (Dockerfile, compose, entrypoint, CI) e o que
  precisa existir desde o primeiro commit para o `compose up` nunca quebrar.

**4.** Monte `docs/plano-de-entrega.md`: blocos de 2–4 h na ordem que mantém o projeto
sempre entregável (esqueleto + docker + migrations + health primeiro; depois o núcleo;
diferenciais por último, priorizados por ponto/esforço), cada bloco com o commit
esperado e a evidência (teste/comando). Reserve o último bloco para
`/equipe-dev:checklist-entrega` e README. Se o prazo é de N dias, o plano tem folga
de ~20% no fim.

**5.** Apresente à Janice: matriz (contagem por tipo), as decisões com default, o plano
e os riscos. Pergunte com `AskUserQuestion` só o que muda o plano (ex.: ORM, SSE vs WS
se houver preferência). Não comece a implementar — o próximo passo é
`/equipe-dev:feature` por bloco, e a decisão é dela.
