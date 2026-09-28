---
name: infra-docker-ci
description: Infraestrutura reprodutível para serviços NestJS — Dockerfile multi-stage com usuário não-root, docker compose com Postgres e Redis, healthchecks e entrypoint que aplica migrations e seed sem passo manual, GitHub Actions (lint, testes, build) com cache, graceful shutdown drenando workers, health de liveness/readiness com Terminus, logs estruturados com pino, métricas Prometheus e tracing OpenTelemetry. Use ao criar ou revisar Dockerfile, compose, pipeline de CI, health checks, shutdown ou observabilidade.
paths:
  - "**/Dockerfile*"
  - "**/docker-compose*.yml"
  - "**/compose*.yml"
  - "**/.github/workflows/**"
  - "**/main.ts"
  - "**/health*.ts"
---

# Infra reprodutível: sobe com um comando, cai sem perder trabalho

## Dockerfile multi-stage

```dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json ./
COPY --chown=node:node docker/entrypoint.sh ./entrypoint.sh
USER node
EXPOSE 3000
ENTRYPOINT ["./entrypoint.sh"]
```

- `.dockerignore` com `node_modules`, `dist`, `.git`, `.env`, `coverage`.
- Migrations precisam existir na imagem final (`dist/migrations` ou a pasta SQL) e o
  runner de migration precisa estar em `dependencies`, não `devDependencies` — erro
  clássico do `npm prune`.
- `USER node` depois de copiar com `--chown`; nada roda como root.
- `node:22-alpine` traz npm 10; localmente pode haver npm 12, que bloqueia scripts de
  instalação por padrão. Se o projeto depende de pacote com build nativo, o `npm ci` da
  imagem precisa do mesmo tratamento (`npm install-scripts approve` não persiste no
  lockfile — prefira dependências puras ou documente o passo no Dockerfile).

## Entrypoint

```sh
#!/bin/sh
set -e
echo "aplicando migrations"; npm run migration:run:prod
echo "seed";                 npm run seed:prod            # idempotente
echo "iniciando API";        exec node dist/main.js       # exec: PID 1 recebe SIGTERM
```

`exec` é obrigatório: sem ele o shell fica como PID 1 e o Node não recebe `SIGTERM`.

## docker compose

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment: { POSTGRES_USER: app, POSTGRES_PASSWORD: app, POSTGRES_DB: app }
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck: { test: ["CMD-SHELL", "pg_isready -U app -d app"], interval: 5s, timeout: 3s, retries: 10 }
  redis:
    image: redis:7-alpine
    healthcheck: { test: ["CMD", "redis-cli", "ping"], interval: 5s, timeout: 3s, retries: 10 }
  api:
    build: .
    env_file: .env.docker            # valores de exemplo, claramente fictícios
    ports: ["3000:3000"]
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
    healthcheck: { test: ["CMD", "wget", "-qO-", "http://localhost:3000/health/ready"], interval: 10s, retries: 6 }
volumes: { pgdata: {} }
```

- Para provar fan-out entre réplicas: `docker compose up --scale api=2` com um proxy
  (nginx/traefik) na frente, ou duas portas mapeadas — e um cliente SSE em cada.
- `docker compose down -v && docker compose up --build` numa pasta limpa é o teste de
  aceitação; a saída dessa sequência vai para o README.

## Graceful shutdown

`app.enableShutdownHooks()` liga SIGTERM/SIGINT aos lifecycle hooks. Num provider,
`beforeApplicationShutdown` espera os jobs ativos do BullMQ (`worker.close()`), encerra
os streams SSE com um evento `server_shutdown` e só então fecha Redis e banco:

```ts
app.enableShutdownHooks();

async beforeApplicationShutdown() {
  await this.worker.close();
  await this.sseRegistry.closeAll();
  await this.redis.quit();
  await this.dataSource.destroy();
}
```

- Ordem: parar de aceitar HTTP → drenar workers (com limite, ex. 25 s) → fechar
  conexões. O grace period do orquestrador precisa ser maior que o limite.
- Teste: `docker compose kill -s SIGTERM api` com um turno em andamento; o log mostra o
  job concluído antes de `exit 0`.

## Health (Terminus)

- `GET /health/live`: processo responde (sem dependências).
- `GET /health/ready`: `TypeOrmHealthIndicator`/`PrismaHealthIndicator` + ping Redis
  (`MicroserviceHealthIndicator` ou indicador custom com `PING`). Readiness falhando
  tira a réplica do balanceador; liveness falhando reinicia — não misture.

## CI (GitHub Actions)

```yaml
name: ci
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run lint
      - run: npm run build
      - run: npm test -- --ci
      - run: npm run test:e2e         # Testcontainers usa o Docker do runner
```

- Testcontainers funciona no runner `ubuntu-latest` sem configuração; alternativa é
  `services:` com postgres/redis e variáveis de conexão.
- Lint com violação **falha** o job (`eslint --max-warnings 0` se quiser rigor).

## Observabilidade

- Logs: `nestjs-pino` (JSON, `correlationId` por request via `genReqId`, redact de
  `authorization`/`cookie`); nível `debug` só fora de produção.
- Métricas: `prom-client` em `/metrics` — `agent_turn_duration_seconds` (histogram),
  `agent_turn_total{status}`, `sse_connections_active`, `queue_jobs_waiting`.
- Tracing: `@opentelemetry/sdk-node` + auto-instrumentations (http, pg, ioredis),
  exportador OTLP configurável por env; iniciar **antes** de importar o Nest.

## Checklist

- [ ] `compose up` limpo: migrations → seed → API pronta → health verde, sem passo manual
- [ ] imagem final sem devDependencies, não-root, versões fixadas
- [ ] `SIGTERM` com job em andamento termina o job antes de sair (testado)
- [ ] readiness reflete Postgres e Redis; liveness não depende deles
- [ ] CI roda lint + build + testes e falha em violação
- [ ] `.env` fora do git; `.env.example` completo
