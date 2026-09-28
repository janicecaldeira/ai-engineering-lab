# rag-lab

Projeto de aprendizado de RAG (Retrieval-Augmented Generation), construído do zero em
TypeScript/Node.js sobre uma stack de custo zero. Não é produto — é aprendizado: o
objetivo é sair sabendo explicar e defender cada peça do pipeline (chunking, embedding,
indexação, retrieval, geração, avaliação), não só ver o app rodando.

PRD completo: `../docs/requisitos/2026-09-28-projeto-rag-aprendizado.md`.

**Status:** v1 completa — os 4 blocos do PRD implementados e validados contra
infraestrutura real (Postgres/pgvector, embedding local, Groq real): ingestão+chunking,
embedding+indexação, retrieval+geração, avaliação. Taxa de acerto medida: **11/20
(55%)** — ver "Avaliação (bloco 4)" para o número por categoria e o porquê.

## Corpus da v1

Os `SKILL.md` e `agents/*.md` de `../agent-skills/plugins/equipe-dev/` (22 arquivos
markdown, ~1700 linhas). Escolhido por já estar no repo, ser estruturado e não ter
nenhum dado sensível — permite indexar sem esperar nada externo e sem acionar a regra
de segurança sobre dado sensível saindo da máquina.

## Decisões

Cada decisão abaixo segue o formato contexto → opções → escolha → custo aceito.

### Vector store: pgvector (Postgres via Docker), não Chroma

**Contexto:** projeto de aprendizado rodando na máquina da Janice, ambas as opções são
gratuitas e locais.

**Opções:** Chroma (embutido, `npm install` e pronto, zero infra) vs. pgvector (extensão
de vetor sobre Postgres, precisa de Docker).

**Escolha:** pgvector. Ensina o mecanismo de verdade — índice de vetor, operador de
distância, `EXPLAIN` de uma busca por similaridade — em vez de esconder tudo atrás de
uma API de coleção. Também é o caminho que mais se transfere: é o vector store mais
comum em RAG de produção hoje, e a Janice já tem a skill `postgres-modelagem`/Mnemósine
no repositório para esse ORM.

**Custo aceito:** mais fricção de setup (subir container, escrever schema/índice) do
que Chroma, que funcionaria com zero configuração.

### Embeddings: local, via `@huggingface/transformers` (Node puro), não Gemini

**Contexto:** o PRD pergunta se `sentence-transformers` roda em Node ou se compensa
chamar um serviço Python separado.

**Resposta:** não precisa de Python. `@huggingface/transformers` (sucessor do
`@xenova/transformers`) roda modelos ONNX — incluindo o equivalente ao
`sentence-transformers` — direto em Node/TypeScript, sem servidor auxiliar.

**Opções:** embeddings locais (`onnx-community/all-MiniLM-L6-v2-ONNX`, 384 dimensões) vs. Gemini
embeddings free tier.

**Escolha:** local. Zero chamada de rede por chunk (relevante para um corpus que vai
ser reindexado várias vezes enquanto ela ajusta chunk size), zero dado saindo da
máquina, e sem depender de rate limit de terceiro para uma operação que roda em lote.
Também deixa a arquitetura pronta para a pergunta aberta do PRD sobre apontar isso pro
vault pessoal no futuro (que exige stack 100% local).

**Custo aceito:** primeira execução baixa o modelo (~90 MB) e a inferência em CPU é
mais lenta que uma API — irrelevante para um corpus de 22 arquivos.

### Geração: Groq free tier, não Gemini nem Ollama local

**Opções:** Groq (API gratuita, latência baixa, modelos Llama/Kimi) vs. Gemini free
tier (Google AI Studio) vs. Ollama local (zero rede, mas exige instalar e baixar
modelo de vários GB).

**Escolha:** Groq. API mais simples de configurar que Ollama (sem download de modelo
de GB, sem depender da RAM da máquina), rate limit gratuito generoso o bastante para um
lote de 10-20 perguntas de avaliação, e compatível com o formato OpenAI (fácil de
trocar depois por Ollama se a Janice decidir ir 100% local para o cenário do vault).

**Custo aceito — regra de segurança:** ao contrário do embedding, a geração envia para
fora da máquina os **chunks recuperados** (não o corpus inteiro, só o contexto de cada
pergunta). **Confirmado explicitamente pela Janice em 2026-09-28** — pode enviar.

**Modelo:** `openai/gpt-oss-20b`. A primeira tentativa usou `llama-3.3-70b-versatile`,
que retornou 404 (`model_not_found`) na primeira chamada real em 2026-09-28 — o Groq
tirou Llama 3.3 70B e Llama 3.1 8B do tier gratuito em 2026-08-16. Confirmado contra
`GET /openai/v1/models` com a chave real: os modelos de chat ativos no free tier hoje
são a família `openai/gpt-oss-*` e `qwen/qwen3.8-27b`. Escolhido `gpt-oss-20b` por ser
o meio-termo entre `gpt-oss-120b` (mais lento) e a família Qwen (menos testada para
instrução em português).

### Retrieval: limiar de distância + instrução ao modelo (duas camadas, não uma)

**O problema, com números reais:** calibrei o limiar rodando perguntas reais contra o
Postgres indexado (script descartável, não ficou no repo). Resultado — distância de
cosseno (`<=>`) do melhor chunk para cada pergunta:

| Pergunta | Distância do melhor chunk |
|---|---|
| "Como organizar módulos de um projeto NestJS?" (relevante) | 0.415 |
| "Como funciona paginação por cursor no Postgres?" (relevante) | 0.471 |
| "Quando usar BullMQ?" (relevante) | 0.434 |
| "Vai chover amanhã em São Paulo?" (fora do corpus) | 0.426 |
| "Qual time ganhou a última Copa do Mundo?" (fora do corpus) | 0.528 |
| "Qual a distância Terra-Júpiter?" (fora do corpus) | 0.659 |
| `"asdkj qwoeiru zxcvb 12345"` (gibberish) | 0.733 |

**A distância sozinha não separa limpo.** A pergunta sobre clima (fora do corpus) ficou
com distância **menor** que duas perguntas relevantes de verdade — MiniLM-L6-v2 num
corpus de domínio estreito (tudo é sobre engenharia de software) comprime demais a
distância entre "mesmo assunto" e "assunto diferente, mas ainda texto técnico/coerente
em português". Só gibberish sem estrutura linguística se separa com folga (>0.73).

**Decisão — duas camadas, não uma:**
1. **Filtro grosso na busca** (`LIMIAR_DISTANCIA_MAXIMA = 0.65`, em `src/retrieval/buscar.ts`):
   corta o caso óbvio (nada parecido foi encontrado) antes de gastar uma chamada ao Groq.
   Pega gibberish e perguntas bem distantes (ex.: a de Terra-Júpiter, 0.659 > 0.65), mas
   **não pega** pergunta natural fora do domínio com distância moderada (a de futebol,
   0.528, passaria por esse filtro).
2. **Instrução explícita no prompt** (`montarPrompt` em `src/geracao/responder.ts`): o
   modelo recebe ordem de responder só com base no contexto e usar a frase exata
   `"não encontrei contexto suficiente para responder com confiança."` quando o contexto
   não bastar. Essa é a defesa de verdade contra alucinação neste corpus — o limiar
   numérico é só uma otimização de custo/latência para o caso óbvio, não uma garantia.

**Custo aceito:** a camada 2 depende do modelo obedecer a instrução — validado no
bloco 4 (ver abaixo): funciona bem para recusar, mas é conservadora demais em alguns
casos relevantes.

### Avaliação (bloco 4) — 11/20 (55%), rodado contra Groq real em 2026-09-28

**Dataset:** `src/avaliacao/dataset.json`, 20 perguntas — 15 "relevante" (resposta
esperada escrita à mão a partir do texto real dos chunks, cada uma citando o arquivo
fonte) + 5 "fora-do-corpus" (as mesmas usadas pra calibrar o limiar no bloco 3, sem
resposta esperada — o único critério de acerto é recusar).

**Julgamento — duas regras diferentes, não uma só:**
- **"fora-do-corpus": determinístico.** Acertou se e só se o sistema recusou (seja
  pela camada 1 — filtro de distância — seja pela camada 2 — o modelo recusando no
  texto). Não precisa de LLM pra isso, é booleano.
- **"relevante": juiz por LLM** (`src/avaliacao/julgar.ts`, mesmo modelo
  `openai/gpt-oss-20b`, `response_format: json_object`, pede `{correto, justificativa}`
  comparando a resposta obtida com a esperada por conteúdo, não por texto idêntico).
  Escolhido em vez de julgamento 100% manual porque o objetivo do bloco 4 é poder
  **rerodar** a avaliação depois de mudar `tamanhoMaximo` do chunking ou o limiar de
  distância e comparar números — 20 perguntas lidas à mão a cada rodada não escala.
  **Custo aceito:** o juiz é o mesmo provedor/modelo que gera a resposta (não um modelo
  mais forte e independente, que não existe de graça) — viés de auto-avaliação é uma
  limitação real, não uma garantia formal como o RAGAS teria. Compensação: toda
  pergunta "relevante" tem uma `respostaEsperada` escrita por mim a partir do texto
  real do corpus, então o juiz está comparando contra um gabarito fixo, não julgando
  no vácuo.

**Resultado, com a saída completa do `npm run avaliar` como evidência:**

| Categoria | Acerto |
|---|---|
| fora-do-corpus (recusa) | 5/5 (100%) |
| relevante (resposta correta) | 6/15 (40%) |
| **Total** | **11/20 (55%)** |

**O achado que importa: o gargalo é retrieval, não alucinação.** Das 9 perguntas
relevantes que falharam, 5 foram recusa incorreta (`"recusou respondendo, mas a
pergunta era respondível pelo corpus"`) — a camada 2 (bloco 3) é conservadora demais:
quando os 5 chunks recuperados não trazem o fato exato pedido, o modelo prefere
recusar a arriscar, mesmo com distância boa (0.37–0.48, bem dentro da faixa que o
bloco 3 calibrou como "relevante"). As outras 4 responderam, mas incompletas ou
imprecisas frente ao gabarito — o caso mais claro é `nest-bootstrap`: os 5 chunks
recuperados eram sobre outra coisa (personas do Dédalo/Mnemósine/Hermes, não o trecho
de bootstrap do NestJS de `nestjs-arquitetura/SKILL.md`), e a resposta trouxe detalhes
de um projeto NestJS genérico (`.eslintrc.js`, `app.controller.spec.ts`) que **não
estavam no contexto fornecido** — a instrução "nunca invente" não impediu o modelo de
completar com conhecimento próprio quando o contexto real não bastava. É a alucinação
mais concreta que encontrei na sessão, mesmo com a defesa de prompt.

**Camada 2 confirmada funcionando para o que foi desenhada:** as 5 perguntas
fora-do-corpus que passaram pelo filtro de distância (0.43–0.66, abaixo do limiar de
0.65) foram todas recusadas corretamente pelo modelo — sem nenhuma alucinação nesse
lado. O problema é ela ser conservadora demais do lado "relevante", não frouxa demais
do lado "fora do corpus".

**O que eu faria diferente numa v2 (não implementado, fora do escopo deste bloco):**
aumentar `LIMITE_PADRAO` de 5 para 8–10 chunks (dar mais chance da SKILL.md certa
aparecer), ou reduzir o `tamanhoMaximo` do chunking pra granularidade mais fina (o
`nest-bootstrap` provavelmente está diluído dentro de um chunk de 800 caracteres que
tem mais coisa além do comando). Os dois são testáveis rerodando `npm run avaliar` e
comparando a taxa — é exatamente pra isso que o bloco 4 existe.

**Ajuste operacional feito no meio do bloco, não planejado:** a primeira tentativa de
`npm run avaliar` travou 3m24s e falhou (`Groq nao retornou conteudo`) — `gpt-oss-20b`
é um modelo de raciocínio e gasta 500-700 tokens de "pensamento" por chamada mesmo pra
recusar; ~35 chamadas seguidas (geração + juiz) sem pausa provavelmente estouraram o
rate limit por minuto do tier gratuito, e o SDK ficou tentando de novo até desistir.
Corrigido com `reasoning_effort: "low"` nas duas chamadas (`responder.ts`, `julgar.ts`)
e uma pausa de 500ms entre itens (`PAUSA_ENTRE_ITENS_MS`); também tornei
`avaliarDataset` resiliente por item (`resultadoDeErro`) — um item que falhar não
derruba os outros 19, fica marcado como incorreto com o erro registrado. Depois do
ajuste, a rodada completa (20 perguntas, geração + juiz) levou 3 minutos, sem erro.

### Sem framework (nem LangChain.js, nem LlamaIndex.TS)

**Contexto:** decisão pedagógica — o PRD pede o trade-off concreto, quem escolhe é a
Janice, mas pede também a recomendação do Dédalo.

**Trade-off:**
- **Com framework:** chega a ponta-a-ponta mais rápido, chunkers/loaders/retrievers já
  testados — mas esconde exatamente o que ela quer aprender atrás de `.query()`: onde o
  chunk corta, como o batch de embedding é feito, a conta de similaridade, como o prompt
  é montado.
- **Sem framework:** mais código na mão (parsing de markdown, chunking, cliente do
  pgvector, prompt manual), mas cada linha é uma decisão que ela consegue explicar —
  que é a métrica de sucesso do próprio PRD.

**Escolha:** sem framework. O corpus é pequeno (22 arquivos) — não há ganho de escala
que justifique o framework — e o objetivo declarado é profundidade, não velocidade de
entrega.

**Custo aceito:** mais código para escrever e manter nos blocos seguintes.

### Runtime e ferramentas de apoio

- **`tsx`** para rodar os scripts TypeScript direto, sem passo de build — importa numa
  iteração de aprendizado onde ela vai reindexar e testar chunk size várias vezes.
- **`node --env-file=.env`** (nativo do Node 20.6+) em vez de `dotenv` — o runtime já
  resolve isso, dependência a menos.
- **`pgvector` (pacote npm)** para serializar/parsear o tipo `vector` do Postgres com o
  `pg` driver — evita reinventar o parser de `"[0.1,0.2,...]"` à mão, que é fácil de
  errar em casos de borda (notação científica, precisão).
- **`groq-sdk`** (cliente oficial) em vez de `fetch` cru — dá tipagem e streaming prontos
  para a chamada de geração.
- **Testes: `node --test` nativo**, sem Jest/Vitest — Node 22 já traz test runner e
  assertions (`node:assert/strict`) embutidos; para 16 testes síncronos/assíncronos sem
  banco nem rede, não há necessidade que justifique uma dependência de teste.
- **Postgres do compose usa `POSTGRES_HOST_AUTH_METHOD=trust`, porta em `127.0.0.1` e
  URL sem senha** — desenvolvimento local, sem exposição externa, sem literal com cara
  de segredo no repositório versionado.

### Ingestão e chunking (bloco 1)

**Padrão de arquivo do corpus, confirmado no disco antes de fixar o glob:**
`agents/*.md` (7 arquivos, um nível, sem recursão) e `skills/*/SKILL.md` (15 arquivos,
um por subpasta de skill). Os `reference/*.md` que existem dentro de duas skills
(`nestjs-arquitetura`, `redis-filas-tempo-real`) ficam de fora — o PRD define o corpus
como "`SKILL.md`/`agents/*.md`", não qualquer markdown dentro da árvore de skills.
Consequência prática também testada: uma skill sem `SKILL.md` (pasta existe, arquivo
não) e um arquivo sem permissão de leitura caem no mesmo caminho de "pulado, arquivo
ilegível" — não é preciso tratamento especial para eles.

**Chunking por tamanho fixo com sobreposição** (não por cabeçalho markdown):
`tamanhoMaximo: 800` caracteres, `sobreposicao: 120` caracteres.

- **Por que 800:** o modelo de embedding escolhido para o bloco 2
  (`onnx-community/all-MiniLM-L6-v2-ONNX`) trunca em 256 tokens. 800 caracteres de texto técnico em
  português fica bem abaixo desse limite, sem truncamento silencioso.
- **Por que overlap de 120:** mitiga perder contexto exatamente na fronteira do chunk
  (mitigação padrão citada nas fontes de chunking do PRD — Redis, Weaviate).
- **Conferido contra o corpus real:** arquivos vão de 1001 a 6927 caracteres (média
  4009) — com esse tamanho, cada arquivo vira de 2 a 10 chunks (rodado e confirmado:
  133 chunks para os 22 arquivos). Granularidade nem tão grossa (arquivo inteiro) nem
  tão fina (parágrafo isolado).
- **Custo aceito:** corte por posição de caractere, não por estrutura do markdown — um
  chunk pode cortar no meio de uma frase ou juntar o frontmatter YAML de um `SKILL.md`
  com o início da descrição. É a linha de base mais simples de explicar e testar; se a
  avaliação do bloco 4 mostrar que isso prejudica a qualidade das respostas, a
  alternativa fica registrada aqui: chunking por cabeçalho markdown (`##`).

### Schema e reindexação (bloco 2)

**Sem framework de migration** (Prisma/TypeORM/Drizzle) — não há convenção prévia no
repositório para seguir, e uma tabela para um projeto de aprendizado não justifica a
dependência. `src/indexacao/schema.sql` é a fonte da verdade (DDL puro, `CREATE TABLE
IF NOT EXISTS`/`CREATE INDEX IF NOT EXISTS` — idempotente por natureza), aplicado pela
própria `npm run ingerir` a cada execução via `aplicarSchema()`.

**Índice HNSW** (`vector_cosine_ops`), não IVFFlat — IVFFlat precisa de uma fase de
treino (k-means) que se comporta mal com poucas linhas (o corpus tem 133 chunks);
HNSW não tem esse pré-requisito e é a recomendação atual do próprio pgvector para
a maioria dos casos. Confirmado com `EXPLAIN`: a busca por similaridade usa
`Index Scan using chunks_embedding_hnsw_idx`, não sequential scan.

**Idempotência por `DELETE` + `INSERT` dentro de uma transação, por arquivo, não só
`ON CONFLICT`** — a constraint única `(arquivo_origem, indice)` está no schema (defesa
em profundidade), mas sozinha não bastaria: se a Janice mudar o `tamanhoMaximo` do
chunking e um arquivo passar a gerar menos chunks que antes, um `ON CONFLICT DO UPDATE`
deixaria as linhas de índice mais alto órfãs (texto/embedding da configuração antiga).
`indexarChunks()` apaga todas as linhas dos arquivos que estão sendo reprocessados antes
de inserir as novas — reindexação sempre correta, sem acumular lixo. Verificado rodando
`npm run ingerir` duas vezes seguidas: 133 chunks antes, 133 depois.

**Sem `registerTypes` do pacote `pgvector`** — ele existe para fazer o driver `pg`
devolver a coluna `vector` já como `number[]` nas leituras. Bloco 2 só grava (nunca lê
embedding de volta pro JS), e registrar isso por conexão do `Pool` tem uma corrida
conhecida (o primeiro `query` pode rodar antes do `registerTypes` terminar). Sem uso
real ainda, não vale o risco — só `toSql()` para serializar o vetor na escrita.

## Estrutura

```
rag-lab/
├── docker-compose.yml       Postgres + pgvector, local, porta 127.0.0.1
├── .env.example             DATABASE_URL e GROQ_API_KEY (vazios, ver acima)
└── src/
    ├── config/              carrega e valida variáveis de ambiente
    ├── db/                  cliente de conexão Postgres compartilhado
    ├── ingestao/             lê o diretório do corpus (.md), pula ilegível sem derrubar
    ├── embedding/            gera embeddings locais (@huggingface/transformers)
    ├── indexacao/            schema.sql + grava chunks/embedding no Postgres, idempotente
    ├── retrieval/            busca por similaridade + criterio de "contexto insuficiente"
    ├── geracao/              monta o prompt e chama o Groq
    ├── avaliacao/            dataset.json (20 perguntas) + roda o pipeline e mede acerto
    └── cli/                  scripts de entrada: ingerir, perguntar, avaliar
```

Cada pasta é um estágio do pipeline do PRD. `db/` e `config/` são infraestrutura
compartilhada entre estágios, não um estágio em si.

## Plano de implementação por blocos

Cada bloco termina em algo que roda e é testável — vira um `/equipe-dev:feature` por
vez.

1. **Ingestão + chunking** ✅ — ler `.md` do corpus, dividir em chunks com metadata
   (arquivo de origem, posição), pular arquivo vazio/ilegível sem derrubar o processo.
   Testável sem rede nem banco. `npm run ingerir` lê o corpus real e reporta contagem de
   chunks por arquivo (ainda sem gerar embedding nem gravar em banco — isso é bloco 2).
2. **Embedding + indexação** ✅ — gerar embedding local de cada chunk, subir o Postgres
   via compose, criar schema com coluna `vector`, gravar chunk + embedding + metadata.
   `npm run ingerir` agora faz o pipeline completo: le o corpus, chunka, gera embedding
   (`onnx-community/all-MiniLM-L6-v2-ONNX`) e grava no Postgres/pgvector, de forma
   idempotente. Validado contra Postgres real: 133 chunks indexados, índice HNSW em uso
   (`EXPLAIN` confere), reexecução não duplica.
3. **Retrieval + geração** ✅ — dado uma pergunta, gera o embedding dela, busca os
   chunks mais próximos por similaridade no Postgres, monta o prompt com o contexto e
   chama o Groq, responde com as fontes citadas. `npm run perguntar -- "pergunta"` é o
   CLI. Critério de "contexto insuficiente" documentado acima com números reais de
   calibração. Envio de dado ao Groq confirmado pela Janice em 2026-09-28; chamada real
   validada (modelo trocado de `llama-3.3-70b-versatile`, que saiu do tier gratuito,
   para `openai/gpt-oss-20b`).
4. **Avaliação** ✅ — dataset de 20 perguntas (15 relevantes + 5 fora do corpus) com
   resposta esperada, rodado contra o pipeline completo (Postgres real + Groq real).
   Julgamento determinístico para recusa, juiz por LLM para resposta relevante.
   **Taxa de acerto: 11/20 (55%)** — 5/5 na recusa, 6/15 nas relevantes. Achado
   principal documentado acima: o gargalo é qual chunk é recuperado, não alucinação.
   `npm run avaliar` é o CLI.

## Como rodar

```bash
cp .env.example .env
npm install
npm install-scripts approve onnxruntime-node   # motor de inferencia do @huggingface/transformers
docker compose up -d                            # Postgres + pgvector, aguarda ficar "healthy"
npm run typecheck   # tsc --noEmit
npm test            # node --test, 53 testes (chunking, ingestão, indexação, retrieval, prompt, avaliação)
npm run ingerir      # le o corpus real, gera embedding local, grava no Postgres (idempotente)
npm run perguntar -- "Como devo organizar os módulos de um projeto NestJS?"
npm run avaliar      # roda as 20 perguntas do dataset contra o pipeline completo, imprime a taxa de acerto
```

`CORPUS_DIR` (opcional, no `.env`) sobrescreve o caminho do corpus; o padrão é
`../agent-skills/plugins/equipe-dev`, resolvido a partir da raiz do `rag-lab`.

`npm install-scripts approve onnxruntime-node` já foi rodado e autorizado pela Janice
nesta máquina (o npm 12 bloqueia scripts de pós-instalação por padrão); registrado aqui
como o padrão do time pede.

### Pendência de verificação — chamada real ao Groq

`GROQ_API_KEY` está vazia no `.env` desta máquina/sessão — nenhuma ferramenta de IA deve
criar ou digitar uma chave de API sua por você, isso é uma ação que só você faz. Todo o
resto do bloco 3 foi validado de ponta a ponta contra dados reais (Postgres com os 133
chunks, embedding local, critério de corte); só a chamada `chat.completions.create` ao
Groq em si não foi exercitada nessa sessão.

**Fechada em 2026-09-28**, depois que a Janice colou a chave no `.env`: a primeira
tentativa com `llama-3.3-70b-versatile` deu 404 (modelo saiu do tier gratuito em
2026-08-16); troquei para `openai/gpt-oss-20b` (confirmado contra `GET
/openai/v1/models`) e a chamada real funcionou.

```bash
# no .env, preencha GROQ_API_KEY com a sua chave (gerada em https://console.groq.com)
npm run perguntar -- "Como devo organizar os módulos de um projeto NestJS?"
```

## Não-escopo (herdado do PRD)

GraphRAG, RAG agêntico, contextual retrieval, reranking pago, interface web,
multi-usuário, controle de acesso por documento, deploy em produção, e apontar para o
vault pessoal (`SegundoCerebro`) — essa última fica para uma fase 2 explicitamente
aprovada, com stack 100% local (sem Groq/Gemini).
