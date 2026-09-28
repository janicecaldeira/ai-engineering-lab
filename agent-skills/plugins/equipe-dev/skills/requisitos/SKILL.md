---
name: requisitos
description: Levanta requisitos com a persona de produto — problema, usuários, escopo, histórias INVEST e critérios de aceite Dado/Quando/Então — e devolve um PRD enxuto com premissas e perguntas abertas.
disable-model-invocation: true
argument-hint: [tema ou pedido]
---

Levante os requisitos de: **$ARGUMENTS**

1. Delegue ao subagent `equipe-dev:atena` (Agent tool) com o pedido acima e o contexto
   relevante desta conversa (arquivos citados, restrições já ditas). Peça o PRD no formato
   da persona, gravado em `docs/requisitos/` se o projeto tiver `docs/`.
2. Ao receber o resultado, apresente à Janice:
   - o problema em uma frase e as métricas de sucesso;
   - as histórias com critérios de aceite;
   - o não-escopo;
   - **as perguntas abertas** — faça-as agora com `AskUserQuestion`, uma por vez, só as
     que mudam materialmente o que será construído. Premissas que não mudam nada, apenas
     registre.
3. Atualize o PRD com as respostas. Não comece a implementar: o próximo passo é
   `/equipe-dev:feature` ou `@equipe-dev:arquiteto`, e isso é decisão dela.
