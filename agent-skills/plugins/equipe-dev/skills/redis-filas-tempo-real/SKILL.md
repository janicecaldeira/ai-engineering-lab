---
name: redis-filas-tempo-real
description: Padrões para Redis em serviços NestJS — filas e workers com BullMQ (retry, backoff, dead-letter, idempotência de job, graceful drain), pub/sub para fan-out entre réplicas, entrega em tempo real por SSE ou WebSocket com reconexão e retomada (Last-Event-ID, Redis Streams), indicador de digitando e streaming em chunks, rate limiting e cache com invalidação. Use ao desenhar ou revisar processamento assíncrono, tempo real, filas, rate limit ou cache com Redis.
paths:
  - "**/*.processor.ts"
  - "**/*.worker.ts"
  - "**/*.gateway.ts"
  - "**/*.sse.ts"
  - "**/*queue*.ts"
---

# Redis: filas, pub/sub e tempo real

Receitas e trade-offs. O fluxo completo de um "turno" assíncrono com streaming e falha
está em [reference/turno-do-agente.md](reference/turno-do-agente.md).

## Conexões

- Uma conexão ioredis por papel: comandos, **subscriber dedicado** (conexão em modo
  subscribe não aceita outros comandos) e BullMQ (`maxRetriesPerRequest: null`,
  obrigatório para Worker).
- Prefixo de chaves por serviço/ambiente (`ideal:conv:...`); TTL em tudo que é cache.

## Filas com BullMQ (`@nestjs/bullmq`)

```ts
BullModule.forRootAsync({ useFactory: (cfg) => ({ connection: { url: cfg.redisUrl } }) });
BullModule.registerQueue({ name: 'agent-turn' });

await queue.add('turn', { turnId }, {
  jobId: `turn:${turnId}`,
  attempts: 5,
  backoff: { type: 'exponential', delay: 1_000 },
  removeOnComplete: 1_000,
  removeOnFail: false,
});
```

`jobId` derivado do turno é o que torna o enfileiramento idempotente: reenviar a mesma
mensagem não cria um segundo job. `removeOnFail: false` deixa as falhas inspecionáveis.

```ts
@Processor('agent-turn', { concurrency: 5 })
class AgentTurnProcessor extends WorkerHost {
  async process(job: Job<{ turnId: string }>) { /* idempotente: revalida estado antes de agir */ }
  @OnWorkerEvent('failed') onFailed(job: Job, err: Error) { /* attemptsMade === opts.attempts → falha persistente */ }
}
```

- **jobId derivado da chave de idempotência**: enquanto o job existir, `add` com o mesmo
  id é ignorado — é a segunda linha de defesa depois da constraint no banco.
- **Processador idempotente**: lê o estado atual antes de agir; se o turno já está
  concluído, sai sem efeito. Retry pode reexecutar um job que falhou depois de persistir.
- **Falha persistente** (`attemptsMade >= attempts`): marque o estado como `failed`,
  emita evento para os clientes, e mova para uma fila `agent-turn-dlq` (ou mantenha no
  conjunto `failed` com um endpoint/alerta) — o importante é ter dono e procedimento.
- **Stalled**: `lockDuration` maior que o pior caso do processamento; job travado volta
  para a fila e é reprocessado — mais um motivo para idempotência.
- **Timeout**: aborte a geração com `AbortController` após N segundos; timeout é falha
  normal, com retry.
- **Graceful drain**: no `onModuleDestroy`/`beforeApplicationShutdown`, `await
  worker.close()` espera os jobs ativos; pare de aceitar HTTP antes.

## Fan-out entre réplicas (pub/sub)

- Canal por conversa: `conv:<id>`; o worker publica (`typing`, `chunk`, `message`,
  `turn_failed`); cada réplica assina só as conversas com clientes conectados
  (`SUBSCRIBE` no primeiro cliente, `UNSUBSCRIBE` no último) ou usa `PSUBSCRIBE conv:*`
  quando o volume é pequeno.
- Pub/sub é **fire-and-forget**: quem estava desconectado não recebe. Para retomada, os
  eventos precisam existir em outro lugar (abaixo).

## Retomada após queda

Duas opções, escolha e justifique:

| Opção | Como | Custo |
|---|---|---|
| **Redis Streams** por conversa (`XADD conv:<id>:ev MAXLEN ~ 1000`) | pub/sub acorda; cliente reconecta com `Last-Event-ID` = id do stream; servidor faz `XRANGE conv:<id>:ev (<id> +` e reenvia | mais uma estrutura, janela limitada por MAXLEN |
| **Banco como fonte** | eventos finais (mensagens) já persistidos; ao reconectar, cliente pede histórico após o último `seq` recebido; chunks perdidos não são repostos | simples; perde só chunks parciais, que o `message` final compensa |

Em ambos: o `id:` de cada evento SSE é o cursor. Chunks são efêmeros por natureza; a
mensagem final é a verdade.

## SSE vs WebSocket

| | SSE | WebSocket |
|---|---|---|
| Direção | servidor → cliente | bidirecional |
| Reconexão | nativa (`retry:`, `Last-Event-ID`) | manual |
| Proxies/HTTP | HTTP puro, fácil de passar | precisa de upgrade |
| Auth | header só com cliente `fetch`; `EventSource` puro não manda header (use token curto na query ou cookie) | header no handshake ou query |
| Quando | streaming de resposta, notificações | cliente também envia em tempo real |

Envio de mensagem é `POST`; entrega é streaming: **SSE resolve o caso** com menos
peça. WebSocket (`@WebSocketGateway` + adapter Redis) só se o cliente precisar de canal
de subida persistente.

SSE em Nest: `@Sse('conversations/:id/events')` retornando `Observable<MessageEvent>`
(`{ id, type, data }`) ou resposta manual com `res.write` para controlar heartbeat
(`: ping\n\n` a cada 15–30 s), `Cache-Control: no-cache`, `X-Accel-Buffering: no`.
Feche a assinatura no `close` da request para não vazar subscriber.

## Rate limiting

- `@nestjs/throttler` com storage Redis (`@nestjs-throttler-storage-redis`), chave =
  `userId` (não IP atrás de proxy); limites diferentes por rota (`@Throttle`); resposta
  `429` com `Retry-After`.
- Alternativa sem lib: janela fixa `INCR` + `EXPIRE` na primeira chamada, ou sliding
  window em Lua para precisão. Justifique a escolha.

## Cache com invalidação

- Cache-aside: `GET ctx:<conv>` → miss → monta do banco → `SET ... EX 300`.
- Invalidar (`DEL`) a cada nova mensagem, no mesmo ponto que persiste; nunca confiar só
  no TTL para correção.
- Cachear o que é caro e lido muitas vezes (contexto recente, resumo do usuário); não
  cachear o que é escrito a cada request.

## Checklist de revisão

- [ ] jobId determinístico + processador idempotente + estado persistido com transições
- [ ] attempts/backoff/timeout/DLQ definidos e testados (falha injetada)
- [ ] nenhum estado intermediário fica órfão: caminho de falha marca `failed` e notifica
- [ ] fan-out por pub/sub funciona com 2 réplicas (testado subindo duas instâncias)
- [ ] reconexão recupera o que dá (cursor/`Last-Event-ID`) e o README diz o que se perde
- [ ] heartbeat SSE, limpeza de assinatura no disconnect
- [ ] rate limit por usuário no endpoint de envio; 429 com `Retry-After`
- [ ] worker fecha graciosamente; conexões Redis separadas por papel
