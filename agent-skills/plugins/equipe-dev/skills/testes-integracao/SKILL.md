---
name: testes-integracao
description: Testes de integração e e2e para NestJS com Postgres e Redis reais via Testcontainers, supertest, testes de SSE e WebSocket, testes de concorrência (idempotência, ordenação), workers BullMQ em teste, injeção determinística de falha do provedor, configuração de Jest para e2e e execução em CI. Use ao escrever ou revisar testes que precisam de banco, fila ou tempo real reais.
paths:
  - "**/test/**"
  - "**/*.e2e-spec.ts"
  - "**/*.spec.ts"
  - "**/jest*.config.*"
---

# Testes de integração e e2e com infraestrutura real

Mock só na fronteira externa (provedor de IA, HTTP de terceiros). Postgres e Redis
reais em container: é o único jeito de provar constraint, lock, fila e pub/sub.

## Testcontainers

`test/setup/containers.ts`, registrado como `globalSetup` do Jest, sobe os containers
uma vez por execução; o `globalTeardown` lê `globalThis.__containers` e chama `stop()`:

```ts
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer } from '@testcontainers/redis';
export default async function globalSetup() {
  const pg = await new PostgreSqlContainer('postgres:16-alpine').start();
  const redis = await new RedisContainer('redis:7-alpine').start();
  process.env.DATABASE_URL = pg.getConnectionUri();
  process.env.REDIS_URL = redis.getConnectionUrl();
  (globalThis as any).__containers = { pg, redis };
}
```

- Migrations rodam contra o container antes dos testes (no `globalSetup` ou no
  `beforeAll` do app factory); nunca `synchronize`.
- Isolamento entre testes: `TRUNCATE ... RESTART IDENTITY CASCADE` das tabelas de dados
  no `beforeEach`, e `FLUSHDB` no Redis. Mais rápido e mais honesto que transação
  revertida quando há worker envolvido.
- Timeouts: `jest.setTimeout(60_000)` para e2e; o pull da imagem na primeira vez é lento
  (CI: cache de imagens ou pré-pull).

## App factory para e2e

`aplicarConfiguracaoGlobal` é a mesma função que o `main.ts` usa (pipes, filtros,
prefixo): o e2e exercita a configuração real, não uma cópia.

```ts
export async function criarApp(overrides?: (b: TestingModuleBuilder) => void) {
  const builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(AGENT_PROVIDER).useValue(new AgentProviderMock({ failureRate: 0, latencyMs: 0 }));
  overrides?.(builder);
  const app = (await builder.compile()).createNestApplication({ rawBody: true });
  aplicarConfiguracaoGlobal(app);
  await app.init();
  return app;
}
```

`aplicarConfiguracaoGlobal` compartilhada com `main.ts` é o que garante que o e2e testa a
API que roda em produção.

## Concorrência: idempotência e ordenação

```ts
it('reenvios com a mesma Idempotency-Key criam uma unica mensagem e um unico job', async () => {
  const key = randomUUID();
  const respostas = await Promise.all(Array.from({ length: 10 }, () =>
    request(app.getHttpServer()).post(`/conversations/${conv.id}/messages`)
      .set('Authorization', `Bearer ${token}`).set('Idempotency-Key', key)
      .send({ content: 'oi' })));
  expect(respostas.filter(r => r.status === 202)).toHaveLength(1);
  expect(respostas.filter(r => r.status === 200)).toHaveLength(9);
  expect(await contarMensagens(conv.id)).toBe(1);
  expect(await fila.getJobCounts()).toMatchObject({ waiting: 1 });
});

it('envios paralelos recebem seq contiguo e sem repeticao', async () => {
  await Promise.all(Array.from({ length: 20 }, (_, i) => enviar(`m${i}`)));
  const seqs = (await listar(conv.id)).map(m => m.seq).sort((a, b) => a - b);
  expect(seqs).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
});
```

## Worker e falha injetada

- Rode o `Worker` no próprio processo de teste, conectado ao Redis do container;
  espere o resultado com `QueueEvents` (`waitUntilFinished`) ou fazendo polling do
  estado do turno com timeout curto — nunca `sleep` fixo.
- Falha determinística: `AgentProviderMock({ failureRate: 1 })` → após `attempts`
  esgotados (use `attempts: 2, backoff: 10ms` no teste) o turno está `failed`, existe o
  evento `turn_failed`, e **não** existe mensagem do agente parcial.
- Falha no meio do stream: mock que lança após N chunks → nenhum conteúdo parcial
  persistido; retry gera a resposta inteira uma vez só.
- Reprocessamento: chame `process(job)` duas vezes com o mesmo job → um efeito.

## SSE e WebSocket

SSE com `fetch` nativo (Node 20+): o supertest não lida bem com stream aberto.

```ts
async function lerEventos(url: string, token: string, ate: (ev: Evento) => boolean, ms = 5000) {
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), ms);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: ctrl.signal });
  const reader = res.body!.getReader(); const dec = new TextDecoder(); let buf = ''; const eventos: Evento[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      let idx; while ((idx = buf.indexOf('\n\n')) >= 0) {
        const bloco = buf.slice(0, idx); buf = buf.slice(idx + 2);
        const ev = parseSse(bloco); if (ev) { eventos.push(ev); if (ate(ev)) return eventos; }
      }
    }
  } finally { clearTimeout(timer); ctrl.abort(); }
  return eventos;
}
```

- Teste o contrato: `typing` antes do primeiro `chunk`; concatenação dos `chunk` igual
  ao `content` da `message` final; `id` crescente; reconexão com `Last-Event-ID`
  devolve só o que faltou.
- WebSocket: cliente `ws` no teste; `await new Promise(r => ws.on('open', r))`; mesmo
  contrato de eventos.
- Duas réplicas: dois `createNestApplication` no mesmo teste, cliente conectado na A,
  envio pela B, evento chega na A via pub/sub.

## Jest

O scaffold do Nest CLI 12 vem com **Vitest**; se o enunciado pede Jest, troque antes de
escrever o primeiro teste (receita na skill `nestjs-arquitetura`, seção Bootstrap). Com
`ts-jest`, fixe `typescript@^5.9` no projeto; com `@swc/jest` a versão do TS não importa,
mas aprove o script de instalação do `@swc/core` no npm 12.


- `jest-e2e.json` separado: `testRegex: .e2e-spec.ts$`, `globalSetup`/`globalTeardown`,
  `maxWorkers: 1` (um banco só) ou schema por worker.
- Scripts: `test` (unitários, sem container), `test:e2e` (containers), `test:cov`.
- CI: `ubuntu-latest` tem Docker; Testcontainers funciona sem configuração.

## Checklist

- [ ] e2e usa a mesma configuração global do `main.ts`
- [ ] idempotência e ordenação testadas **sob concorrência**, não sequencialmente
- [ ] falha do provedor testada (esgotamento de retry e falha no meio do stream)
- [ ] SSE testado de ponta a ponta, incluindo retomada
- [ ] nada de `sleep` fixo; espera por condição com timeout
- [ ] isolamento entre testes garantido; suíte roda limpa duas vezes seguidas
