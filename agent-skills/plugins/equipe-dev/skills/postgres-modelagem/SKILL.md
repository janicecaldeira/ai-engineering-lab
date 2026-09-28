---
name: postgres-modelagem
description: Modelagem e persistência em PostgreSQL para serviços NestJS — schema e migrations versionadas (TypeORM, Prisma, Drizzle), ordenação estável e determinística sob concorrência, paginação por cursor (keyset), índices por query, busca textual (tsvector + GIN), constraints de idempotência com ON CONFLICT, transações e locks de linha, seed idempotente. Use ao desenhar tabelas, escrever migrations, revisar queries ou decidir paginação, ordenação e busca.
paths:
  - "**/migrations/**"
  - "**/*.entity.ts"
  - "**/schema.prisma"
  - "**/*.repository.ts"
  - "**/seed*.ts"
---

# PostgreSQL: modelagem que sustenta as garantias

Comece pelos acessos (o que o sistema lê e escreve, com que frequência e sob que
concorrência); tabelas, constraints e índices são derivados deles.

## Escolha de ORM (se o repositório ainda não tem)

| | TypeORM | Prisma | Drizzle |
|---|---|---|---|
| Integração Nest | oficial (`@nestjs/typeorm`) | via serviço próprio | via serviço próprio |
| Migrations | geradas + SQL editável | `prisma migrate` (SQL editável) | SQL gerado, editável |
| Colunas geradas / FTS / índices parciais | SQL na migration | SQL na migration (`Unsupported` no schema) | suporte direto |
| Transação com lock de linha | `queryRunner` / `manager.transaction` | `$transaction` + raw SQL | `db.transaction` |

Qualquer um serve; o que não serve é `synchronize: true` como mecanismo de schema.
Justifique em uma frase e siga.

## Ordem estável e determinística

`created_at` **não** é determinístico: dois inserts no mesmo microssegundo, relógio de
réplicas diferentes, transação que começa antes e commita depois. Use uma sequência
monotônica **por escopo**:

```sql
-- na mesma transação que insere a mensagem: o UPDATE trava a linha da conversa
UPDATE conversations SET last_seq = last_seq + 1 WHERE id = $1 RETURNING last_seq;
INSERT INTO messages (id, conversation_id, seq, ...) VALUES ($2, $1, <last_seq>, ...);
-- garantia no banco:
ALTER TABLE messages ADD CONSTRAINT messages_conv_seq_uk UNIQUE (conversation_id, seq);
```

- Serializa escritas **da mesma conversa** (o que é desejado); conversas diferentes
  não se bloqueiam. Sem buracos, sem repetição, mesmo com N réplicas.
- Alternativas e por que perdem: `BIGSERIAL`/sequence global — o valor é atribuído no
  **insert**, não no **commit**: a transação que pegou o id 5 pode commitar depois da que
  pegou o 6, e um leitor paginando por cursor que já passou do 6 nunca vê o 5 (buraco que
  aparece depois). O lock da linha da conversa serializa a transação inteira, então a
  ordem de `seq` é a ordem de commit. `created_at` + `id` como desempate (estável, mas
  não reflete chegada e tem o mesmo problema de commit tardio); timestamp do cliente
  (nunca). Se ainda assim escolher serial global, diga no README que o cursor pode
  perder linhas de transações concorrentes lentas e como mitiga (ex.: cursor com margem).
- A mensagem do agente recebe `seq` pela mesma regra, na transação que fecha o turno.

## Paginação por cursor (keyset)

```sql
SELECT * FROM messages
WHERE conversation_id = $1 AND seq < $2        -- $2 = cursor (seq da última recebida)
ORDER BY seq DESC LIMIT $3 + 1;                -- +1 para saber se há próxima página
CREATE INDEX messages_conv_seq_idx ON messages (conversation_id, seq DESC);
```

- Cursor opaco (`base64(seq)`), estável sob inserções concorrentes, custo constante por
  página. Offset custa `O(offset)` e pula/duplica itens quando entram mensagens novas —
  aceitável só para listas pequenas e estáticas (ex.: lista de conversas ordenada por
  `updated_at`, ainda assim prefira cursor composto `(updated_at, id)`).

## Idempotência no banco

```sql
CREATE UNIQUE INDEX messages_idem_uk ON messages (conversation_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX messages_provider_uk ON messages (channel, provider_message_id)
  WHERE provider_message_id IS NOT NULL;

INSERT INTO messages (...) VALUES (...)
ON CONFLICT (conversation_id, idempotency_key) WHERE idempotency_key IS NOT NULL
DO NOTHING RETURNING *;
-- nenhuma linha retornada → SELECT a existente e responda 200 (não 201), sem enfileirar
```

- Chave do cliente: header `Idempotency-Key` (uuid gerado pelo cliente) com escopo por
  conversa/usuário; guarde por tempo limitado se a tabela crescer (ou para sempre —
  custo baixo, simplicidade alta: justifique).
- Webhook: a chave natural é o id da mensagem do provedor.
- Trade-off: índices parciais mantêm a unicidade só onde há chave; `ON CONFLICT` exige
  índice/constraint exatamente compatível com a cláusula.

## Busca textual

```sql
ALTER TABLE messages ADD COLUMN search tsvector
  GENERATED ALWAYS AS (to_tsvector('portuguese', coalesce(content, ''))) STORED;
CREATE INDEX messages_search_idx ON messages USING GIN (search);

SELECT m.*, ts_rank(m.search, q) AS rank
FROM messages m, websearch_to_tsquery('portuguese', $1) q
WHERE m.conversation_id = $2 AND m.search @@ q
ORDER BY rank DESC, m.seq DESC LIMIT 20;
```

- Busca entre conversas do usuário: junte com `conversations.user_id = $u` (índice em
  `conversations(user_id)`); nunca buscar sem o filtro do dono.
- `ILIKE '%x%'` não usa índice B-tree; só com `pg_trgm` + GIN, e aí é busca por
  substring, não por relevância — diga qual comportamento o produto quer.
- Busca vazia (`q` sem termos) → 400 com mensagem útil, ou lista vazia; decida e teste.

## Escopo por usuário e integridade

- `conversations.user_id NOT NULL` + FK; toda leitura filtra pelo usuário do token.
- Enums como `CHECK` ou tipo enum do Postgres (migração para adicionar valor é mais
  chata; `CHECK` com texto é mais flexível) — escolha e justifique.
- `timestamptz` sempre; `updated_at` mantido pela aplicação ou trigger.

## Migrations e seed

- Uma migration por mudança, nome com timestamp e intenção; `down` quando for barato.
- Rodam **antes** do app subir (entrypoint do container ou `migration:run` no CI);
  nunca em `onModuleInit` de uma réplica qualquer sem lock.
- Seed idempotente: `INSERT ... ON CONFLICT (chave natural) DO UPDATE` ou checagem
  prévia; rodar duas vezes deixa o banco igual. Dados financeiros de demonstração com
  categorias e meses variados para que "quanto gastei em mercado?" tenha resposta.

## Checklist de revisão

- [ ] toda garantia crítica (unicidade, ordem, integridade) existe como constraint
- [ ] cada índice tem uma query dona; nenhuma query crítica sem índice (`EXPLAIN`)
- [ ] paginação por cursor na listagem que cresce; offset justificado onde ficou
- [ ] `ON CONFLICT` compatível com o índice parcial; duplicado responde sem enfileirar
- [ ] FTS com dicionário do idioma e índice GIN; filtro por dono sempre presente
- [ ] migrations rodam do zero num banco vazio e o seed é idempotente
