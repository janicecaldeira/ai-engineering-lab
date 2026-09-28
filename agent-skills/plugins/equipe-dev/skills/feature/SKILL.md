---
name: feature
description: Ciclo completo de uma feature com a equipe — Atena levanta requisitos, Dédalo desenha (com Mnemósine, Hefesto ou Íris quando há dados, infra ou interface), implementação passo a passo com commits incrementais, Argos testa, revisão em contexto limpo, Hermes documenta — com pontos de parada para aprovação.
disable-model-invocation: true
argument-hint: [descrição da feature ou bloco do plano]
---

Conduza o ciclo completo de: **$ARGUMENTS**

Copie este checklist na resposta e marque conforme avança:

```
- [ ] 1. Requisitos (Atena)
- [ ] 2. Aprovação do PRD                ← parada
- [ ] 3. Blueprint (Dédalo + Mnemósine/Hefesto/Íris se aplicável)
- [ ] 4. Aprovação do blueprint          ← parada
- [ ] 5. Implementação passo a passo, commit por passo
- [ ] 6. Testes (Argos)
- [ ] 7. Revisão em contexto limpo
- [ ] 8. Documentação (Hermes)
- [ ] 9. Evidência e resumo
```

**1. Requisitos.** Se existe `docs/matriz-requisitos.md` ou `docs/plano-de-entrega.md`,
leia e use; senão delegue a `equipe-dev:atena`. Pedido claro e pequeno → três linhas de
critério de aceite e siga.

**2. Parada.** Mostre problema, histórias, critérios e não-escopo. Perguntas abertas
com `AskUserQuestion`. Só avance com aprovação explícita.

**3. Blueprint.** Delegue a `equipe-dev:dedalo` com o PRD aprovado. Se envolve schema,
migrations, paginação ou busca, peça a Dédalo que delegue a parte de dados a
`equipe-dev:mnemosine`; se envolve Docker, CI, health ou shutdown, a
`equipe-dev:hefesto`; se envolve uma interface (console, página de teste), a
`equipe-dev:iris`. Blueprint no formato da persona, com a sequência de passos.

**4. Parada.** Apresente a decisão e o trade-off. Aprovação explícita antes de tocar
código.

**5. Implementação.** Um passo do blueprint por vez, mantendo o projeto compilando e
os testes verdes. Ao fim de cada passo, pergunte se comete; com o sim, invoque
`/equipe-dev:commit` pela Skill tool (commit incremental é critério de avaliação em
desafios; a decisão de cometer é dela). Registre qual persona implementou cada passo —
a revisão (7) precisa disso. **Código sem comentários**: o porquê de cada decisão vai na
mensagem de commit e no ADR, não no arquivo — quem implementa não deixa `//` nem JSDoc
(só diretivas de ferramenta). Mudança cirúrgica: nada fora do escopo aprovado. Se o blueprint se mostrar errado no meio, pare
e diga — não improvise em silêncio.

**6. Testes.** Delegue a `equipe-dev:argos` com os critérios de aceite e o diff. Exija
a saída da suíte, incluindo os testes de concorrência quando o comportamento envolve
idempotência ou ordenação.

**7. Revisão.** Invoque `/equipe-dev:revisao` pela Skill tool, informando quem
implementou cada parte: **o revisor é sempre uma persona diferente de quem escreveu o
código** (a skill traz a tabela de substituição). Personas em paralelo, contexto limpo,
confiança ≥ 80. Corrija o que afeta correção ou requisito; o resto é lista opcional.

**8. Documentação.** Delegue a `equipe-dev:hermes`: seção do README/ADR para as
decisões desta feature e a linha correspondente na matriz de requisitos com a
evidência.

**9. Evidência.** Resumo: o que foi construído, saída de testes/build, arquivos
tocados, o que ficou fora do escopo e por quê, perguntas abertas. Sem push — é decisão
da Janice.
