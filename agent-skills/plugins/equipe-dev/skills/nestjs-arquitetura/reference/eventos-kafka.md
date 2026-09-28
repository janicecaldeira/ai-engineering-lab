# Eventos e Kafka em NestJS — checklist

## Contents
- Contrato do evento
- Produtor
- Consumidor
- Retry, DLQ e ordenação
- Testes

## Contrato do evento

- Nome no passado, com contexto: `pedido.criado`, `cobranca.falhou`. Um tópico por
  agregado ou por evento — escolha do repo, mas consistente.
- Envelope: `id` (uuid), `type`, `version`, `occurredAt`, `correlationId`,
  `causationId`, `payload`. Schema versionado (JSON Schema/Avro); mudança incompatível
  = versão nova, nunca alteração silenciosa.
- Payload carrega o necessário para o consumidor não precisar chamar de volta
  (evita acoplamento síncrono escondido).

## Produtor

- Chave de partição = id do agregado quando a ordem por agregado importa.
- **Outbox** quando o evento nasce dentro de transação de banco: grava evento na mesma
  transação, relay publica depois. Sem outbox, aceite explicitamente a perda ou a
  duplicata e documente.
- Publicação idempotente (`enable.idempotence`/`acks=all` ou equivalente do client).

## Consumidor

- **Idempotente por `id`**: guarda ids processados (tabela ou cache com TTL maior que a
  janela de reentrega) e ignora repetido. Efeito colateral único mesmo com redelivery.
- Commit de offset **depois** do efeito persistido. `autoCommit` desligado quando o
  processamento tem efeito colateral.
- Handler pequeno: desserializa → valida schema → chama service de domínio. Regra de
  negócio fora do handler para ser testável sem Kafka.
- Falha de negócio (dado inválido) não é retry: vai para DLQ com motivo. Falha de infra
  (timeout, conexão) é retry.

## Retry, DLQ e ordenação

- Retry com backoff exponencial e limite; depois DLQ. Tópico de retry separado quando a
  ordenação do tópico principal não pode ser bloqueada.
- DLQ tem consumidor humano: alerta, dashboard, procedimento de reprocessamento.
- Ordenação garantida só dentro de uma partição; consumidor que depende de ordem entre
  agregados está errado por desenho.
- Rebalance: consumers param de puxar no shutdown (graceful) para não duplicar em deploy.

## Testes

- Handler: teste unitário com a mensagem como entrada; mesma mensagem duas vezes → um
  efeito (idempotência).
- Integração: broker em container (testcontainers) ou client em memória, provando
  serialização, chave e commit de offset.
- Contrato: fixture do evento versionado validada contra o schema em CI.
