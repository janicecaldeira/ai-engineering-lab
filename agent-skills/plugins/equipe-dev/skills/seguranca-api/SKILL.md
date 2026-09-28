---
name: seguranca-api
description: Segurança de APIs NestJS — autenticação JWT com dados escopados por usuário, guards e decorators, validação de webhook por assinatura HMAC com comparação em tempo constante e proteção contra replay, deduplicação de entregas repetidas, segredos via variáveis de ambiente validadas, rate limiting, validação de payload, cabeçalhos de segurança, autenticação em SSE/WebSocket, e o que nunca logar. Use ao implementar ou revisar autenticação, autorização, webhooks, segredos ou exposição de dados.
paths:
  - "**/*.guard.ts"
  - "**/*auth*.ts"
  - "**/*webhook*.ts"
  - "**/*.strategy.ts"
---

# Segurança de API — o mínimo sênior

## Autenticação e escopo

- JWT de acesso (`@nestjs/jwt`), assinado com segredo de env (`JWT_SECRET`, tamanho
  ≥ 32 bytes), expiração curta; refresh só se o produto pedir.
- Guard global (`APP_GUARD`) + decorator `@Public()` para as poucas rotas abertas
  (`/health`, webhook — que tem a própria validação).
- **O id do usuário vem do token, nunca do body ou da query.** Todo repositório recebe
  `userId` e filtra por ele; um recurso de outro usuário responde `404` (não `403`, para
  não confirmar existência) — decida e seja consistente.
- Seed cria usuário(s) de demonstração e o README diz como obter o token (endpoint de
  login mockado ou token fixo de dev — nunca em produção).

## Webhook de entrada (WhatsApp mockado)

- Assinatura: `X-Signature: sha256=<hmac_sha256(segredo, corpo_bruto)>`. Exige o corpo
  **bruto**: `NestFactory.create(AppModule, { rawBody: true })` e `req.rawBody`; o JSON
  reserializado não bate.
- Compare em tempo constante: `crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))`
  depois de checar o tamanho; nunca `===`.
- Replay: header de timestamp assinado junto (`X-Timestamp`), rejeitar fora da janela
  (5 min); e dedupe por id do provedor no banco (`UNIQUE(channel, provider_message_id)`).
- Entrega duplicada responde `200` idempotente (o provedor reenvia se receber erro).
- Rate limit e tamanho máximo de body também no webhook.
- Payload validado como qualquer DTO; campos desconhecidos ignorados
  (`whitelist: true`), erro de forma → `400`, mas erro de negócio dentro do processamento
  → `200` + registro (o provedor não deve reentregar o que já é nosso problema).

## Segredos e config

- `ConfigModule` com schema validado (Joi/Zod): app não sobe com `JWT_SECRET` ou
  `WEBHOOK_SECRET` ausentes. Mensagem de erro diz qual variável falta.
- `.env` no `.gitignore`; `.env.example` com placeholders; `git log -p | grep` antes de
  entregar para garantir que nenhum segredo passou.
- Compose de dev pode ter segredos de exemplo **claramente fictícios**.

## Entrada e saída

- `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`
  global; limites de tamanho (`content` ≤ N caracteres) no DTO.
- Filtro de exceção global: corpo padrão (`statusCode`, `code`, `message`,
  `correlationId`); nunca stack trace nem mensagem de driver para o cliente.
- `helmet()`; CORS com allowlist explícita; `app.set('trust proxy', 1)` se houver proxy
  (rate limit por IP depende disso).

## Tempo real

- `EventSource` não envia headers: aceite token de curta duração via query string
  (`?token=`) gerado a partir do JWT, **ou** cookie `HttpOnly` **ou** exija cliente
  `fetch` com `Authorization`. Documente a escolha; nunca logue a query string com token.
- Autorize a assinatura do canal: a conversa pertence ao usuário do token.

## Logs

- Nunca: tokens, segredos, corpo completo de webhook, PII além do id. Sempre:
  `correlationId`, `userId`, ids de recurso, resultado.

## Checklist de revisão

- [ ] rotas protegidas por padrão; `@Public()` só onde justificado
- [ ] nenhuma query lê dado de outro usuário (teste cruzado existe)
- [ ] webhook: corpo bruto, HMAC em tempo constante, janela de replay, dedupe no banco
- [ ] segredos só em env, validados na subida, ausentes do git
- [ ] rate limit no envio; 429 com `Retry-After`
- [ ] erros não vazam internals; logs sem segredo
