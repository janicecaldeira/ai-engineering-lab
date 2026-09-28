---
name: nestjs-arquitetura
description: Padrões de arquitetura para serviços NestJS em Node.js/TypeScript — módulos por feature, injeção de dependência, DTOs e validação, erros, config, eventos/Kafka, observabilidade e organização de pastas. Use ao criar ou revisar módulos, controllers, services, consumers ou ao decidir a estrutura de um serviço NestJS.
paths:
  - "**/*.module.ts"
  - "**/*.controller.ts"
  - "**/*.service.ts"
  - "**/*.consumer.ts"
  - "**/nest-cli.json"
---

# Arquitetura NestJS — critérios de decisão

Referência para desenhar e revisar. O repositório manda: quando um padrão daqui divergir
do que o código já faz de forma consistente, siga o código e anote a divergência.

## Bootstrap de um projeto novo (verificado em 2026-09-18)

`nest new <nome> --package-manager npm --strict` com o Nest CLI 12 gera **NestJS 12 +
TypeScript 6 + Vitest 4 + oxlint + Prettier**. Quando o enunciado ou o time exige
**Jest** e **ESLint**, troque logo no primeiro commit:

- Testes: remover `vitest`/`@vitest/coverage-v8` e os `vitest.config*.ts`; instalar
  `jest ts-jest @types/jest` (ou `@swc/jest`), criar `jest.config.ts` e `test/jest-e2e.json`;
  scripts `test`, `test:e2e`, `test:cov`.
- Lint: remover `oxlint`/`oxlint-tsgolint`; instalar `eslint typescript-eslint
  eslint-config-prettier eslint-plugin-prettier`, `eslint.config.mjs` (flat config) e
  script `lint: eslint "{src,test}/**/*.ts" --max-warnings 0`.
- TypeScript: fixar `typescript@^5.9` no projeto até `ts-jest`/`typescript-eslint`
  declararem suporte à 6.x; `strict: true` já vem do `--strict`.
- npm 12 **bloqueia scripts de instalação por padrão** (`npm warn install-scripts`):
  pacotes com build nativo (`bcrypt`, `@swc/core`, `esbuild`) precisam de
  `npm install-scripts approve <pkg>` ou de alternativas puras (`bcryptjs`). Registre
  no README o que aprovou e por quê — o `npm ci` do Dockerfile também precisa.

## Organização

- **Um módulo por feature** (`src/pedidos/`, `src/cobranca/`): controller(s), service(s),
  DTOs, entidades/schemas e testes juntos. Infra compartilhada (`src/shared/` ou
  `src/infra/`) só para o que dois ou mais módulos usam de verdade.
- Exporte só o que outro módulo precisa (`exports`). `@Global()` apenas para
  transversais reais (config, logger). Ciclo de imports é sinal de fronteira errada.
- Módulos de integração externa (Kafka, HTTP client, cache) como **dynamic modules**
  (`forRoot`/`forRootAsync`) configurados a partir do `ConfigModule`.

## Injeção de dependência

- Constructor injection, `private readonly`. Tokens (`Symbol`/string + interface) quando
  há mais de uma implementação plausível — repositório, gateway externo, relógio.
- Sem `new` de colaborador dentro de service. Sem `ModuleRef.get` para contornar DI.
- Escopo padrão singleton; `Scope.REQUEST` só com motivo (custo e propagação).

## Fronteira HTTP

- DTO de entrada com `class-validator`/`class-transformer` (ou Zod, se o repo usa) +
  `ValidationPipe({ whitelist: true, transform: true })` global.
- Controller fino: valida, chama service, mapeia resposta. Regra de negócio no service.
- Resposta de erro consistente: exceção de domínio → `ExceptionFilter` → corpo padrão
  (`code`, `message`, `details`, `correlationId`). Nunca vazar stack para o cliente.
- Versionamento explícito (`/v1`) e paginação em toda listagem.

## Eventos, filas e tempo real

- Kafka/eventos entre serviços: [reference/eventos-kafka.md](reference/eventos-kafka.md)
  (idempotência, outbox, retry/DLQ, schema, ordenação, testes de consumer).
- Filas internas (BullMQ), pub/sub, SSE/WebSocket, rate limit e cache: skill
  `redis-filas-tempo-real`.
- Schema, ordenação, paginação e busca: skill `postgres-modelagem`.
- Auth, escopo por usuário, webhooks assinados: skill `seguranca-api`.
- Docker, compose, CI, health, shutdown, observabilidade: skill `infra-docker-ci`.

## Config, observabilidade, operação

- `ConfigModule` com **schema validado** na subida (Joi/Zod); a aplicação falha rápido
  com config errada. Segredo nunca em código nem em log.
- Log estruturado (JSON) com `correlationId` propagado por request e por mensagem.
- Health checks (`@nestjs/terminus`) de liveness e readiness separados; readiness
  inclui dependências críticas.
- Graceful shutdown habilitado (`enableShutdownHooks`) — consumers param de puxar
  antes de encerrar.

## Dados

- Repositório por agregado, atrás de interface quando o domínio é rico; direto no
  ORM quando é CRUD simples. Sem abstração especulativa.
- Migração versionada no repo; nunca `synchronize: true` fora de teste local.
- Transação onde há invariante entre tabelas; outbox quando a transação precisa emitir
  evento.

## Checklist de revisão (use como rubrica)

- [ ] Módulo por feature, sem import cíclico, sem `@Global()` gratuito
- [ ] Nenhum `any`, nenhum `catch` vazio, nenhuma promessa sem `await`/tratamento
- [ ] DTO valida a entrada; service não revalida
- [ ] Erro de domínio mapeado; resposta de erro no padrão do repo
- [ ] Consumer idempotente; produtor com chave e outbox se houver transação
- [ ] Config validada; sem segredo em código
- [ ] Log com correlação nos pontos de decisão
- [ ] Testes cobrindo o comportamento novo (não só o caminho feliz)
- [ ] Dependência nova justificada por escrito

## Comandos usuais

Confirme no `package.json` antes de rodar; os nomes variam por repositório.

```bash
npm run build        # tsc via nest build
npm run lint
npm test             # unitários
npm run test:e2e
```
