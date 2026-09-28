---
name: revisao
description: Revisão em contexto limpo por personas em paralelo — Dédalo (desenho, fronteiras, contratos, filas e tempo real), Argos (correção, bordas, concorrência, testes) e, quando o diff toca migrations/queries, Docker/CI ou HTML/CSS/JS de interface, Mnemósine, Hefesto ou Íris — consolidando só achados com confiança alta.
argument-hint: [escopo: diff, PR, pasta ou arquivo]
---

Revise: **$ARGUMENTS** (se vazio, as mudanças não commitadas).

Olhe o escopo primeiro (`git diff --stat` ou a lista de arquivos) e escolha os
revisores; rode-os **em paralelo** com o Agent tool, cada um em contexto limpo, com a
instrução de reportar só achados com confiança ≥ 80 e impacto em correção, segurança,
operação ou requisito declarado — mais **comentário ou JSDoc no código**, que é sempre
achado (baixa) porque a equipe não escreve código comentado.

**Regra fixa: quem escreveu não revisa.** Antes de escolher, liste quem implementou
cada parte do escopo (a persona delegada no `/equipe-dev:feature`, ou você mesmo se fez
direto) e exclua essa persona da revisão daquela parte — uma segunda instância da mesma
persona em contexto limpo **não** conta como revisor diferente. Substituições:

| Escreveu | Revisa no lugar |
|---|---|
| Dédalo (desenho/implementação) | Argos com a skill `nestjs-arquitetura` carregada, mais Hefesto ou Mnemósine se o diff tocar a área deles |
| Hefesto (Docker, compose, CI, health, config) | Dédalo com a skill `infra-docker-ci` carregada |
| Mnemósine (migrations, entidades, queries) | Dédalo com a skill `postgres-modelagem` carregada |
| Argos (testes) | Dédalo revisa os testes: cobrem os critérios? nomes descrevem comportamento? |
| Íris (HTML/CSS/JS de interface) | Dédalo revisa estrutura/funcionalidade; Hermes revisa se o texto da UI está claro |
| Você, direto, sem delegar | qualquer persona da lista abaixo |

Revisores por ângulo (aplicada a regra acima):

- `equipe-dev:dedalo` — sempre: fronteiras de módulo, contratos, DI, tratamento de erro,
  estados de jobs/turnos, tempo real, consistência com os padrões do repositório.
- `equipe-dev:argos` — sempre: lógica, bordas, concorrência, idempotência, cobertura e
  qualidade dos testes.
- `equipe-dev:mnemosine` — se tocou migrations, entidades, repositórios ou queries:
  constraints, índices, ordenação, paginação, busca.
- `equipe-dev:hefesto` — se tocou Dockerfile, compose, CI, health, shutdown ou config.
- `equipe-dev:iris` — se tocou HTML/CSS/JS de interface (console, página de teste):
  estados vazio/erro/carregando, contraste, consistência de componentes, rotulagem.
- Segurança (auth, webhook, segredos): peça a Argos que carregue a skill
  `seguranca-api` e cubra esse ângulo.

Consolide em uma lista única ordenada por severidade, sem duplicar o mesmo achado vindo
de duas personas, com `arquivo:linha`, cenário de falha e correção sugerida. Estilo e
preferência ficam de fora. Se ninguém achou nada relevante, diga isso em uma linha —
não invente achados para preencher a revisão.
