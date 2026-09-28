---
name: plano-de-testes
description: Mapeia comportamentos, encontra lacunas de cobertura e escreve e roda os testes que faltam com a persona de qualidade, reportando a saída da suíte como evidência.
disable-model-invocation: true
argument-hint: [módulo, arquivo, PR ou "diff"]
---

Planeje e execute os testes de: **$ARGUMENTS** (se vazio ou "diff", use as mudanças
não commitadas — `git diff` e `git status`).

1. Delegue ao subagent `equipe-dev:argos` com o alvo acima, o PRD/critérios de aceite
   se existirem nesta conversa ou em `docs/requisitos/`, e a instrução de **rodar a suíte
   e devolver a saída**.
2. Apresente à Janice:
   - tabela comportamento → camada (unitário/integração/e2e) → status (já coberto / novo
     / sem teste e por quê);
   - a saída resumida da suíte (passou/falhou, contagem);
   - falhas encontradas que são bug no código, não no teste.
3. Se houver bug, não conserte silenciosamente: mostre o achado e pergunte se corrige
   agora.
