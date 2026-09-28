# mcp-lab

Projeto de aprendizado do protocolo **MCP (Model Context Protocol)**. A Janice usa
servidores MCP todo dia (Claude Code) mas nunca construiu um — este projeto expõe o
[`rag-lab`](../rag-lab) (pipeline de RAG já validado, 55% de acerto documentado) através
de um servidor MCP local via stdio, para aprender as três primitivas do protocolo —
tool, resource, prompt — construindo, não só lendo sobre elas.

PRD completo: [`docs/requisitos/2026-09-28-projeto-mcp-aprendizado.md`](../docs/requisitos/2026-09-28-projeto-mcp-aprendizado.md).

**Status:** v1 completa — os 4 blocos do PRD implementados e validados contra
infraestrutura real (Postgres/pgvector do `rag-lab`, embedding local, Groq real, MCP
Inspector via stdio como processo separado): tool `buscar_chunks` (retrieval puro),
tool `perguntar_corpus` (retrieval + geração), resource `arquivos_indexados`, prompt
`nova_pergunta_avaliacao` — uma primitiva de cada tipo, o ponto central da métrica de
sucesso do PRD. 37 testes automatizados (`npm test`), sem rede nem Postgres real. Ver
"As quatro primitivas, de ponta a ponta" no fim deste README para o resumo por
capacidade, e "Como conectar num cliente MCP real" para colocar isso no Claude
Code/Desktop.

## Decisões

### SDK oficial cru (`@modelcontextprotocol/sdk`), não um wrapper de terceiro

**Contexto:** o PRD deixa essa decisão explicitamente para o Dédalo, com o mesmo
critério já usado no `rag-lab` sobre framework — trade-off registrado, quem escolhe
justifica.

**Trade-off:**
- **Wrapper (FastMCP, mcp-framework):** reduz boilerplate — decorators ou funções
  únicas que já cuidam de registro, validação e serialização — mas esconde exatamente o
  que a métrica de sucesso do PRD pede para explicar: como uma tool é registrada no
  protocolo, como o erro de handler vira `isError` no resultado (e não uma exceção que
  derruba o processo), a diferença real entre `tools/list`, `resources/list` e
  `prompts/list` como três capacidades distintas do servidor.
- **SDK oficial cru:** mais chamadas explícitas (`registerTool`, `registerResource`,
  `registerPrompt`, `connect(transport)`), mas cada uma é uma decisão de protocolo que
  ela consegue nomear e defender depois.

**Escolha:** SDK oficial cru, usando a API de alto nível `McpServer` que o próprio
pacote expõe (`server/mcp.js`) — não é um wrapper de terceiro, é a camada ergonômica que
o SDK oficial já documenta como "provides a simpler API for working with resources,
tools, and prompts", com o `Server` de baixo nível acessível via `servidor.server` se
algo exigir controle fino (notificações customizadas, handlers manuais). Dentro do
próprio SDK oficial, dá para explicar as duas camadas sem sair da fonte primária.

**Custo aceito:** mais código de registro por capacidade do que um wrapper daria, mas é
código que ensina o protocolo em vez de escondê-lo — mesmo critério que valeu para
"sem framework" no `rag-lab`.

**Confirmado por experimento, não só pela doc — capacidade por capacidade:** com o
`McpServer` instanciado e nada registrado (bloco 0), `getServerCapabilities() === {}` e
`tools/list` falhava com `McpError -32601 Method not found`. Com `buscar_chunks`
registrada (bloco 1), só `.tools` passou a existir — `.resources`/`.prompts` continuavam
ausentes e `resources/list`/`prompts/list` falhavam do mesmo jeito. Com as quatro
primitivas registradas (bloco 3: 2 tools + 1 resource + 1 prompt), as três capacidades
aparecem juntas em `getServerCapabilities()`. Cada estágio dessa progressão está fixado
como teste de contrato em `src/servidor.test.ts` — não é uma alegação, é o histórico real
de `getServerCapabilities()` mudando conforme cada `registerX` era adicionado.

**Segundo achado, também por experimento — como um erro de handler vira `isError`:**
rodei `buscar_chunks` contra o Postgres real com um limite acima do corpus (999999 > 133
chunks) e com uma query só de espaços. Os dois viram `isError: true`, mas por caminhos
diferentes dentro do próprio SDK (`server/mcp.js`, método `setToolRequestHandlers`): (1)
violação do `inputSchema` Zod (query vazia) é pega **antes** do meu handler rodar —
`validateToolInput` lança `McpError(InvalidParams, ...)`; (2) erro de negócio (limite
maior que o corpus) é um `throw new Error(...)` comum **dentro** do meu handler. Os dois
caem no mesmo `catch` (linha ~135 de `mcp.js`), que chama `createToolError(mensagem)` e
devolve `{ content: [...], isError: true }` — nunca derruba o processo, nunca vira uma
exceção não tratada. Consequência prática: meu handler não precisa montar
`{isError: true, ...}` manualmente para o caso de negócio — `throw new Error(mensagem)`
já basta, é o próprio SDK que empacota. Evidência real (payload completo) em "Como
rodar".

### Estrutura de dependência com o `rag-lab`: import por caminho relativo, não pacote isolado

**Contexto:** o PRD deixa a escolha para o Dédalo, mas a própria história de usuário já
grava o critério de aceite: a tool `perguntar_corpus` precisa chamar "as mesmas funções
de `retrieval`/`geracao` que o `rag-lab` já usa em `npm run perguntar` — sem duplicar a
lógica". Isso reduz a decisão a uma questão de viabilidade técnica, não de gosto.

**Trade-off:**
- **Pacote isolado, só compartilhando `DATABASE_URL`:** desacopla de verdade — mudança
  interna no `rag-lab` nunca quebra o `mcp-lab` — mas exige copiar
  `buscarChunksSimilares`, `contextoSuficiente`, `montarPrompt`, `gerarResposta` (e a
  frase de recusa `MENSAGEM_SEM_CONTEXTO`) para dentro do `mcp-lab`. Duas cópias da
  mesma lógica de retrieval/geração — o critério de aceite do PRD proíbe isso
  explicitamente.
- **Import por caminho relativo dentro do mesmo repo** (`../rag-lab/src/retrieval/buscar.js`
  etc.): fonte única de verdade — muda no `rag-lab`, o `mcp-lab` sente o mesmo
  comportamento sem cópia — mas o `mcp-lab` passa a compilar e rodar contra os módulos
  internos do `rag-lab`, não contra uma API pública estável dele. Renomear ou mover um
  desses arquivos no `rag-lab` quebra o `mcp-lab` imediatamente.

**Escolha:** import por caminho relativo. Testado de verdade antes de fixar a decisão
(não só assumido): com `rootDir` removido do `tsconfig.json` do `mcp-lab` (ver abaixo),
`tsc --noEmit` compila limpo importando `../rag-lab/src/db/cliente.ts` e um tipo de
`../rag-lab/src/retrieval/buscar.ts` de fora do projeto. A resolução de pacotes do Node
(`pg`, `pgvector`, `groq-sdk`, `@huggingface/transformers`) também funciona sem que o
`mcp-lab` declare essas dependências: o Node resolve `node_modules` a partir do arquivo
que importa (`rag-lab/src/...`), não do processo que iniciou — então quem sobe é sempre
o `node_modules` do `rag-lab`.

**Custo aceito, registrado explicitamente:**
- **`mcp-lab` não roda sozinho.** Depende de `rag-lab/node_modules` já instalado
  (`npm install` rodado lá) — se faltar, o erro aparece como módulo não encontrado
  dentro de `../rag-lab/src/...`, confuso para quem não sabe do acoplamento. Documentado
  aqui e em "Como rodar".
- **`tsconfig.json` do `mcp-lab` não declara `rootDir`** (nem `outDir` — o projeto nunca
  compila para `dist`, só roda via `tsx`). Sem essa omissão, o TypeScript recusa
  qualquer arquivo fora de `src/` com `TS6059`.
- **Efeito colateral aceito, não custo:** `mcp-lab/package.json` não repete `pg`,
  `pgvector`, `groq-sdk` nem `@huggingface/transformers` como dependência de runtime —
  zero segunda cópia do runtime de inferência ONNX (pesado) só para rodar o servidor MCP.
  Única exceção, e só de tipos: `@types/pg` entrou como devDependency porque as funções
  do `rag-lab` que reuso (`buscarChunksSimilares`, `obterPool`) são tipadas com `Pool` de
  `"pg"` — sem o pacote de tipos, `tsc` não consegue checar essa fronteira entre os dois
  projetos. Nenhum `Pool` é instanciado pelo `mcp-lab`; ele só recebe a instância que
  `rag-lab/src/db/cliente.ts` já cria.
- Se o acoplamento incomodar no futuro, a migração para pacote isolado é mecânica: copiar
  as quatro funções citadas acima para dentro do `mcp-lab` e trocar os imports — fica
  registrado aqui como plano B, não implementado agora.

### Schema de input/output das tools: Zod

**Contexto:** o PRD deixa o formato do schema para o Dédalo decidir.

**Escolha:** Zod, porque não é uma dependência nova por conveniência — é peer dependency
declarada pelo próprio `@modelcontextprotocol/sdk` (`zod: "^3.25 || ^4.0"`, confirmado
com `npm view @modelcontextprotocol/sdk peerDependencies`). `registerTool` espera um
"raw shape" Zod para `inputSchema`/`outputSchema` e converte para JSON Schema
internamente (via `zod-to-json-schema`, já uma dependência do próprio SDK) — escrever
JSON Schema manual seria reimplementar, com mais código e sem validação em tempo de
compilação, o que o SDK já faz de graça.

**Custo aceito:** mais uma dependência direta no `package.json` (`zod`), mas já estava
implícita pelo SDK — declará-la explicitamente é só deixar visível o que já seria
instalado como peer.

### `perguntar_corpus`: recusa é curto-circuito antes do Groq, não pós-processamento

**Contexto:** o PRD pede que uma pergunta fora do corpus devolva a mesma frase de
recusa do `rag-lab` ("não encontrei contexto suficiente..."), sem inventar.

**Decisão:** `perguntarCorpusHandler` chama `contextoSuficiente(resultados)` (mesma
função do `rag-lab`, baseada no limiar de distância de cosseno) **antes** de chamar o
Groq. Se insuficiente, devolve a recusa direto — zero chamada ao Groq, zero custo,
`fontes: []`. Isso reproduz exatamente o que `rag-lab/src/cli/perguntar.ts` já faz
(mesmo curto-circuito), não é comportamento novo inventado para a tool.

**Nuance que fica registrada, não escondida:** o `rag-lab` tem uma segunda função,
`respostaIndicaRecusa`, que detecta se o **texto que o Groq devolveu** é a recusa
(usada só em `avaliacao/avaliar.ts`, para medir a taxa de acerto — não é usada no CLI).
Ou seja: mesmo quando `contextoSuficiente()` diz que sim, o próprio Groq pode decidir
recusar (o prompt já instrui isso). Quando isso acontece, `perguntar_corpus` devolve as
`fontes` dos chunks recuperados mesmo a resposta sendo uma recusa — porque é exatamente
o que `cli/perguntar.ts` já faz (ele nunca chama `respostaIndicaRecusa`, sempre lista as
fontes recuperadas). Reproduzir esse comportamento do CLI é mais fiel ao "sem duplicar
lógica" do que inventar um tratamento especial que o próprio `rag-lab` não tem.

### Resource `arquivos_indexados`: URI fixa, query nova (não existe no `rag-lab`)

**Contexto:** o PRD pede a lista de arquivos indexados (nome + contagem de chunks),
lida do mesmo Postgres — application-controlled, não é o modelo decidindo chamar.

**Decisões:**
- **URI fixa `corpus://arquivos-indexados`**, não um `ResourceTemplate` — não há
  parâmetro variável (não é "arquivo X", é "a lista inteira"), então `registerResource`
  com uma string de URI é a forma mais simples do SDK, sem template desnecessário.
  Esquema `corpus://` é inventado (URIs de resource MCP não precisam de um esquema
  registrado formalmente), escolhido só para deixar claro que é dado do domínio do
  `rag-lab`, não um arquivo do sistema (`file://`) nem HTTP.
- **Query nova**: `SELECT arquivo_origem, COUNT(*)::int AS contagem FROM chunks GROUP
  BY arquivo_origem ORDER BY arquivo_origem` — não existe equivalente no `rag-lab`
  (ele nunca precisou agregar por arquivo). Vive só em `resources/arquivos-indexados.ts`,
  mesmo padrão de `contarChunksNoPostgres` no bloco 1: query nova quando a necessidade é
  nova, sem forçar o `rag-lab` a crescer para o caso de uso do `mcp-lab`.
- **`mimeType: "application/json"` e corpo serializado com `JSON.stringify`** — o
  resource devolve dado estruturado para a aplicação consumir, não texto para o modelo
  ler; JSON é o formato que um cliente MCP (ou o código por trás dele) processa sem
  parsing ad-hoc.
- **Corpus vazio devolve lista vazia, não erro** — diferente das tools (que validam
  entrada e podem recusar), um resource só descreve o estado atual; "nenhum arquivo
  indexado" é um estado válido, não uma entrada inválida.

### Prompt `nova_pergunta_avaliacao`: função pura, sem Postgres

**Contexto:** o PRD pede um template pedindo pergunta + resposta esperada no formato de
`rag-lab/src/avaliacao/dataset.json`, acionado pelo usuário — "prepara insumo", não
escreve no dataset.

**Decisões:**
- **Zero I/O.** `novaPerguntaAvaliacaoHandler` não recebe `pool` nem qualquer
  dependência externa — é a única das quatro primitivas que não precisa de
  `DependenciasServidor`. Isso não é economia de código, é o próprio contraste
  pedagógico: um prompt é um template parametrizado (substituição de string), não uma
  ação que busca dado ou decide algo.
- **Um argumento opcional, `tema` (string)** — argumentos de prompt no protocolo MCP são
  sempre string (não há tipo numérico/boolean como em tool), então `z.string().optional()`
  é o schema mais simples que respeita isso; a SDK converte automaticamente em
  `PromptArgument { name: "tema", required: false }` (confirmado em "Como rodar").
- **Não escreve em `dataset.json`.** O handler só devolve o texto do template; adicionar
  a entrada de verdade ao dataset fica para revisão manual da Janice — é exatamente o
  "sem duplicar a lógica de avaliação em si" que o PRD pede (a lógica de carregar/validar
  o dataset já existe em `rag-lab/src/avaliacao/dataset.ts`, este prompt não a toca).
- **Formato do JSON hardcoded no texto do prompt**, não gerado a partir de
  `rag-lab/src/tipos.ts` (`ItemAvaliacao`) em tempo de execução — copiar os quatro campos
  (`id`, `pergunta`, `categoria`, `respostaEsperada`, `fonteEsperada`) para dentro da
  string é duplicação de **forma**, não de lógica; ler o `.ts` em runtime para gerar a
  string seria over-engineering para um template que muda raramente.

### O contraste entre as três primitivas, com o `mcp-lab` como exemplo de cada uma

É a própria métrica de sucesso do PRD — "explicar tool vs. resource vs. prompt citando
qual primitiva o `mcp-lab` usou pra cada capacidade e por quê":

| Primitiva | Quem decide invocar | Exemplo no `mcp-lab` | Como foi testado/validado |
| --- | --- | --- | --- |
| **Tool** | O modelo, durante a conversa, decidindo que precisa daquela ação | `buscar_chunks`, `perguntar_corpus` | `tools/call` simulando a decisão do modelo; erro de validação/negócio vira `isError`, não derruba o servidor |
| **Resource** | A aplicação (cliente MCP), carregando como contexto antes/durante a conversa | `arquivos_indexados` | `resources/read` direto, sem "chamada" no sentido de ação — é leitura de estado, nunca falha por entrada inválida (não há entrada) |
| **Prompt** | O usuário, explicitamente (slash command ou menu do cliente) | `nova_pergunta_avaliacao` | `prompts/get` com argumento opcional; é a única primitiva sem efeito colateral nem I/O — puro template |

Diferença que ficou concreta implementando, não só lendo a spec: **tool** é a única das
três que tem "erro de negócio" de verdade (limite inválido, Groq fora do ar) porque é a
única que *faz* algo quando chamada; **resource** não tem conceito de "erro de entrada"
porque não recebe entrada, só um URI fixo — na pior das hipóteses descreve um estado
vazio; **prompt** não toca em infraestrutura nenhuma (sem `pool`, sem rede) porque sua
saída inteira é determinística a partir do argumento que recebe.

### Transporte: stdio, sem servidor remoto

Herdado do PRD (Premissa 3 e Não-escopo) — v1 é local, single-user, mesma máquina.
Registrado aqui só para não perder o porquê: stdio dispensa autenticação de rede (não
tem rede), o que mantém o foco da entrega nas três primitivas do protocolo — misturar
isso com Streamable HTTP e OAuth 2.1 é aprendizado real, mas de outro projeto (ou fase
2), não desta entrega.

## Estrutura

```
mcp-lab/
├── .env.example          DATABASE_URL (mesmo Postgres do rag-lab) e GROQ_API_KEY
└── src/
    ├── config/            valida DATABASE_URL na subida (GROQ_API_KEY fica validação
    │                       tardia, só quando perguntar_corpus roda — buscar_chunks não
    │                       depende do Groq, não pode falhar por causa dele)
    ├── servidor.ts         criarServidor(deps): monta o McpServer, registra as tools
    ├── servidor.test.ts    contract test via InMemoryTransport (tools/resources/prompts)
    ├── index.ts            entrypoint: valida config, monta deps reais, conecta stdio
    ├── tools/
    │   ├── buscar-chunks.ts          schema Zod + handler puro (retrieval, sem Groq) ✅
    │   ├── buscar-chunks.test.ts     unit test do schema e do handler, deps falsas ✅
    │   ├── perguntar-corpus.ts       schema Zod + handler puro (retrieval + Groq) ✅
    │   └── perguntar-corpus.test.ts  unit test do schema e do handler, deps falsas ✅
    ├── resources/
    │   ├── arquivos-indexados.ts       query nova (GROUP BY), handler puro ✅
    │   └── arquivos-indexados.test.ts  unit test com deps falsas ✅
    └── prompts/
        ├── nova-pergunta-avaliacao.ts       template puro, sem deps ✅
        └── nova-pergunta-avaliacao.test.ts  unit test, sem mock (zero I/O) ✅
```

`tools/`, `resources/`, `prompts/` em inglês, não traduzido — são o vocabulário do
próprio protocolo (nomes de método MCP, tipos do SDK: `Tool`, `Resource`, `Prompt`,
`registerTool`). Manter o nome original evita uma camada de tradução entre o que o
código chama e o que a spec/SDK chamam, mesmo critério que manteve `retrieval` e
`embedding` em inglês no `rag-lab`.

Cada handler de tool é uma função pura testável sem subir o servidor (unit test, deps
injetadas por parâmetro — `DependenciasBuscarChunks`: `pool`, `gerarEmbeddingConsulta`,
`contarChunks`), e `servidor.ts` ganha um teste de contrato via `InMemoryTransport` por
capacidade registrada — o padrão em `src/servidor.test.ts`.

**`buscarChunksHandler` não valida "limite maior que o corpus" com uma constante fixa**
— consulta `SELECT COUNT(*)::int AS total FROM chunks` a cada chamada
(`contarChunksNoPostgres`, dentro de `tools/buscar-chunks.ts`, não existe equivalente no
`rag-lab`: lá o limite nunca foi validado contra o tamanho do corpus, só usado com
default 5). Custo aceito: uma query extra por chamada da tool; sem isso, um limite maior
que o corpus simplesmente devolveria menos resultados que o pedido, sem avisar — o PRD
pede erro de validação explícito nesse caso.

## Plano de implementação por blocos

Cada bloco termina em algo testável, sem precisar do bloco seguinte para validar.

0. **Scaffolding** ✅ — `package.json`, `tsconfig.json`, `.env.example`, servidor mínimo
   (`criarServidor()` sem nenhuma capacidade), config valida `DATABASE_URL` na subida,
   contrato inicial testado via `InMemoryTransport` (servidor vazio não anuncia
   capacidades, `tools/list` falha com `Method not found` — comportamento real do SDK,
   não assumido). `npm run typecheck` e `npm test` passam (evidência em "Como rodar").
1. **Servidor mínimo + tool `buscar_chunks`** ✅ — sem Groq, não depende de rede além do
   Postgres. Handler puro (`tools/buscar-chunks.ts`) testável com deps falsas — 12 unit
   tests (schema Zod + handler) e 7 contract tests via `InMemoryTransport` (`tools/list`
   inclui `buscar_chunks`, `resources/list` continua falhando, `tools/call` com sucesso e
   com os dois tipos de erro de validação). Validado também contra o Postgres real do
   `rag-lab` (133 chunks) — evidência completa em "Como rodar".
2. **Tool `perguntar_corpus`** ✅ — reusa `retrieval` + `geracao` do `rag-lab`. 29 testes
   no total (10 novos: 3 schema + 3 unit do handler + 4 contract), cobrindo recusa sem
   chamar o Groq, resposta com fontes únicas, erro do Groq viram `isError` sem derrubar
   o servidor nem quebrar `buscar_chunks` na sequência, e pergunta vazia validada antes
   de gastar embedding/Groq. Validado contra Postgres real: recusa por contexto
   insuficiente e validação de pergunta vazia confirmadas de ponta a ponta; chamada real
   ao Groq com pendência documentada (falta `GROQ_API_KEY`) — evidência em "Como rodar".
3. **Resource + prompt** ✅ — `arquivos_indexados` (lista arquivo + contagem de chunks,
   query nova agregando por `arquivo_origem`) e prompt `nova_pergunta_avaliacao`
   (template puro, zero I/O, no formato de `rag-lab/src/avaliacao/dataset.json`). 37
   testes no total (8 novos: 5 unit + 3 contract), cobrindo `resources/list`,
   `prompts/list`, `resources/read` e `prompts/get` com e sem argumento. Validado contra
   Postgres real: 22 arquivos, 133 chunks — bate com o total documentado no `rag-lab`.
4. **Validação manual** ✅ — MCP Inspector em modo `--cli`, servidor real via stdio como
   processo separado (não `InMemoryTransport`): `tools/list`, `tools/call` em
   `buscar_chunks`, `resources/list`, `resources/read`, `prompts/list`, `prompts/get`
   com argumento — os seis exercitados, todos batendo com o que os testes automatizados
   já previam. Passo a passo reproduzível e saída real em "Validação com o MCP
   Inspector (bloco 4)". Config para conectar num cliente MCP real (Claude Code/Desktop)
   documentada em "Como conectar num cliente MCP real" — não validada rodando (não dá
   para reiniciar um cliente MCP de dentro desta sessão), fica para a Janice ou o
   coordenador confirmarem.

## Como rodar

```bash
cd mcp-lab
cp .env.example .env        # preencher com a mesma DATABASE_URL do rag-lab
npm install
npm run typecheck            # tsc --noEmit
npm test                     # node --test — 37 testes, sem rede nem Postgres real
```

Saída real desta sessão:

```
$ npm run typecheck
npm notice run tsc --noEmit
(sem erros)

$ npm test
# tests 37
# pass 37
# fail 0
```

(14 contract tests em `servidor.test.ts` + 12 unit tests em `tools/buscar-chunks.test.ts`
+ 6 unit tests em `tools/perguntar-corpus.test.ts` + 2 unit tests em
`resources/arquivos-indexados.test.ts` + 3 unit tests em
`prompts/nova-pergunta-avaliacao.test.ts` — schema Zod das duas tools, mapeamento de
resultado, limite padrão/customizado, corpus vazio, limite maior que o corpus, recusa
sem chamar o Groq, fontes únicas, erro do Groq propagado, uma tool falhando não afeta a
outra, `resources/list`/`prompts/list` agora respondem, `resources/read` e `prompts/get`
com e sem argumento.)

**Achado ao rodar de verdade, não só "deveria funcionar":** o script original,
`node --import tsx --test src/**/*.test.ts` (mesmo padrão do `rag-lab`), rodava só 12
dos 19 testes — os 7 de `src/servidor.test.ts` (na raiz de `src/`) eram ignorados em
silêncio. Causa: `npm run` executa o script via `/bin/sh` (sem `globstar`), que expande
`**` como um único nível de diretório; como só existiam arquivos de teste aninhados
(`tools/*.test.ts`), o glob "achava" um resultado parcial e o Node nunca via o padrão
original para aplicar sua própria varredura recursiva (que é correta). Corrigido
citando o glob (`'src/**/*.test.ts'`), forçando o `sh` a não expandir e o Node a
interpretar o `**` ele mesmo. O `rag-lab` tem o mesmo script, hoje "funciona" por
coincidência — todo teste de lá fica um nível abaixo de `src/`, nenhum na raiz.

Validação manual contra o Postgres real do `rag-lab` (`docker compose ps` confirmou
`rag-lab-postgres` "healthy" antes de rodar), via `InMemoryTransport` com as dependências
reais (`obterPool` + `gerarEmbedding` do `rag-lab`, sem Groq):

```
tools/list → buscar_chunks, inputSchema/outputSchema em JSON Schema (convertido do Zod)

tools/call buscar_chunks { query: "Como o Dédalo trata idempotência de trabalho
assíncrono?", limite: 3 }
→ isError ausente; top resultado (distancia=0.4635) é agents/dedalo.md#4, o trecho que
  literalmente descreve idempotência em nível de banco — retrieval semanticamente
  correto contra os 133 chunks reais.

tools/call buscar_chunks { query: "qualquer coisa", limite: 999999 }
→ isError: true, content: "limite 999999 maior que o total de chunks indexados (133)"

tools/call buscar_chunks { query: "   " }
→ isError: true, content: "MCP error -32602: Input validation error: Invalid
  arguments for tool buscar_chunks: query nao pode ser vazia at query"
```

Os dois erros confirmam o achado documentado em "Decisões": mensagens com prefixo
`MCP error -32602` vêm da validação do `inputSchema` (antes do handler); mensagens sem
prefixo vêm de `throw new Error(...)` dentro do handler. Ambos `isError: true`, nenhum
derruba o processo.

`npm start` (`tsx --env-file=.env src/index.ts`) sobe o servidor real e fica ocioso em
stdio aguardando um cliente — testado mantendo stdin aberto (processo permanece vivo) e
sem `DATABASE_URL` (falha rápido, mensagem clara, antes de tentar conectar o
transporte).

**Pré-requisito não gerenciado por este projeto:** o Postgres do `rag-lab`
(`docker compose up -d` dentro de `rag-lab/`) e `rag-lab/node_modules` instalado
(`npm install` dentro de `rag-lab/`) — ver "Custo aceito" acima.

### `perguntar_corpus` contra o Postgres real (bloco 2)

Mesmo método do bloco 1: `InMemoryTransport` com as dependências reais (`obterPool` +
`gerarEmbedding` do `rag-lab`), sem mock, contra os 133 chunks reais.

```
tools/call perguntar_corpus { pergunta: "Qual a distância entre a Terra e Júpiter em
quilômetros?" }
→ isError ausente; structuredContent: { resposta: "não encontrei contexto suficiente
  para responder com confiança.", fontes: [] } — recusa real, sem tocar no Groq (a
  chave nem está configurada nesta máquina; se tivesse tocado, teria falhado).

tools/call perguntar_corpus { pergunta: "   " }
→ isError: true, "MCP error -32602: Input validation error: ... pergunta nao pode ser
  vazia at pergunta" — mesmo padrão de buscar_chunks.

tools/call perguntar_corpus { pergunta: "Como o Dédalo trata idempotência de trabalho
assíncrono?" }  (pergunta dentro do corpus — contextoSuficiente() = true)
→ isError: true, content: "GROQ_API_KEY nao configurada" — confirma que o retrieval
  encontrou contexto (não caiu na recusa) e seguiu até tentar chamar o Groq; o erro é
  exatamente o do rag-lab (mensagem reusada), virou isError sem derrubar o servidor:
  tools/list logo depois ainda respondia ["buscar_chunks","perguntar_corpus"].
```

**Pendência fechada pelo coordenador, com a `GROQ_API_KEY` da Janice** (eu não criei nem
vi a chave — não é evidência desta sessão, é a confirmação registrada pelo coordenador):
pergunta fora do corpus recusou sem tocar o Groq; pergunta dentro do corpus chamou o
Groq de verdade e caiu num caso que o `rag-lab` já documentava — o retrieval achou
"contexto suficiente" pelo limiar de distância, mas o próprio modelo, seguindo a
instrução do prompt, decidiu recusar mesmo assim. `perguntar_corpus` listou as fontes
recuperadas mesmo com a resposta sendo uma recusa — exatamente o comportamento herdado
de `cli/perguntar.ts` que documentei acima em "Nuance que fica registrada, não
escondida", não um bug novo do `mcp-lab`.

### Resource e prompt contra o Postgres real (bloco 3)

Mesmo método dos blocos 1 e 2: `InMemoryTransport` com as dependências reais.

```
resources/list → arquivos_indexados, uri "corpus://arquivos-indexados",
  mimeType "application/json"

prompts/list → nova_pergunta_avaliacao, arguments: [{ name: "tema", required: false }]
  (confirma que a SDK converteu z.string().optional() em required: false)

resources/read corpus://arquivos-indexados
→ 22 arquivos, soma de contagemChunks = 133 — bate exatamente com o total documentado
  no README do rag-lab (133 chunks, 22 arquivos). Primeiros 3: agents/argos.md (8),
  agents/atena.md (6), agents/dedalo.md (8).

prompts/get nova_pergunta_avaliacao (sem tema)
→ mensagem de usuário com o template completo (id/pergunta/categoria/respostaEsperada/
  fonteEsperada), sem menção a tema.

prompts/get nova_pergunta_avaliacao ({ tema: "webhooks" })
→ mesmo template, primeira linha vira 'Gere uma nova pergunta de avaliação sobre
  "webhooks" para o dataset do rag-lab.'
```

## Validação com o MCP Inspector (bloco 4)

Todo teste automatizado até aqui passa pelo `InMemoryTransport` do próprio SDK — é o
protocolo real, mas cliente e servidor rodam no mesmo processo Node, sem stdio de
verdade. O MCP Inspector em modo `--cli` (`@modelcontextprotocol/inspector`, instalado
sob demanda via `npx`, sem virar dependência do projeto) conecta como um cliente MCP
de verdade, via stdio, com o servidor rodando num **processo separado** — é o primeiro
teste que exercita `npm start`/`tsx --env-file=.env src/index.ts` de fato, não o código
importado direto.

**Achado ao descobrir a sintaxe certa, não documentado no `--help`:** o alvo (comando do
servidor) precisa vir logo depois de `--cli`, e toda opção específica do método
(`--method`, `--tool-name`, `--tool-arg`, `--uri`, `--prompt-name`, `--prompt-args`,
`-e`) precisa vir **depois** do alvo, não antes. Colocar `--method` ou `-e` antes do
comando do servidor faz o parser (`commander`) engolir o alvo inteiro em silêncio — sem
erro de sintaxe, só um `"No servers found in config file"` enganoso, como se nenhum alvo
tivesse sido passado. Levou algumas tentativas para isolar isso; documentado aqui para
não repetir a investigação da próxima vez.

Comandos exatos rodados nesta sessão, contra o servidor real (`DATABASE_URL` passada
via `-e`, mesma URL do `.env.example`, sem tocar no `GROQ_API_KEY` — os seis comandos
cobrem tudo que não depende do Groq, que já foi validado por você em produção real):

```bash
cd mcp-lab

npx --yes @modelcontextprotocol/inspector --cli ./node_modules/.bin/tsx src/index.ts \
  --method tools/list -e DATABASE_URL=postgres://raglab@localhost:5432/raglab

npx --yes @modelcontextprotocol/inspector --cli ./node_modules/.bin/tsx src/index.ts \
  --method tools/call --tool-name buscar_chunks \
  --tool-arg query="Como o Dédalo trata idempotência de trabalho assíncrono?" \
  --tool-arg limite=3 -e DATABASE_URL=postgres://raglab@localhost:5432/raglab

npx --yes @modelcontextprotocol/inspector --cli ./node_modules/.bin/tsx src/index.ts \
  --method resources/list -e DATABASE_URL=postgres://raglab@localhost:5432/raglab

npx --yes @modelcontextprotocol/inspector --cli ./node_modules/.bin/tsx src/index.ts \
  --method resources/read --uri corpus://arquivos-indexados \
  -e DATABASE_URL=postgres://raglab@localhost:5432/raglab

npx --yes @modelcontextprotocol/inspector --cli ./node_modules/.bin/tsx src/index.ts \
  --method prompts/list -e DATABASE_URL=postgres://raglab@localhost:5432/raglab

npx --yes @modelcontextprotocol/inspector --cli ./node_modules/.bin/tsx src/index.ts \
  --method prompts/get --prompt-name nova_pergunta_avaliacao --prompt-args tema=webhooks \
  -e DATABASE_URL=postgres://raglab@localhost:5432/raglab
```

Saída real (condensada onde o texto do chunk é longo; nada foi editado além de cortar
`texto` repetido):

```
tools/list
→ 2 tools (buscar_chunks, perguntar_corpus), inputSchema/outputSchema em JSON Schema

tools/call buscar_chunks { query: "Como o Dédalo trata idempotência...", limite: 3 }
→ isError ausente; top resultado distancia=0.4635, agents/dedalo.md#4 — mesmo resultado
  já validado via InMemoryTransport no bloco 1, agora confirmado por processo separado

resources/list
→ 1 resource: arquivos_indexados, uri "corpus://arquivos-indexados",
  mimeType "application/json"

resources/read corpus://arquivos-indexados
→ 22 arquivos; soma de contagemChunks = 133 (conferido somando os 22 valores retornados
  — bate exato). Primeiros 3: agents/argos.md (8), agents/atena.md (6),
  agents/dedalo.md (8)

prompts/list
→ 1 prompt: nova_pergunta_avaliacao, arguments: [{ name: "tema", required: false }]

prompts/get nova_pergunta_avaliacao { tema: "webhooks" }
→ mensagem de usuário com o template completo, primeira linha:
  'Gere uma nova pergunta de avaliação sobre "webhooks" para o dataset do rag-lab.'
```

Todos os seis resultados batem exatamente com o que os testes automatizados e a
validação via `InMemoryTransport` (blocos 1-3) já previam — a diferença aqui é que o
transporte, o processo e a inicialização (`carregarConfig`, `obterPool`, `StdioServerTransport`)
são os reais, não os importados diretamente em teste.

## Como conectar num cliente MCP real

**Não validei isto rodando** — não dá para reiniciar um cliente MCP de dentro desta
sessão para testar a própria conexão. Documentado para a Janice ou o coordenador
confirmarem depois.

Para o Claude Code, em `.mcp.json` na raiz do repo (`ai-engineering-lab/.mcp.json`):

```json
{
  "mcpServers": {
    "mcp-lab": {
      "command": "/Users/janice/Documents/Projetos/ai-engineering-lab/mcp-lab/node_modules/.bin/tsx",
      "args": [
        "/Users/janice/Documents/Projetos/ai-engineering-lab/mcp-lab/src/index.ts"
      ],
      "env": {
        "DATABASE_URL": "postgres://raglab@localhost:5432/raglab",
        "GROQ_API_KEY": "<a mesma chave que está em mcp-lab/.env>"
      }
    }
  }
}
```

Para o Claude Desktop, mesma forma dentro de `claude_desktop_config.json`
(`~/Library/Application Support/Claude/claude_desktop_config.json` no macOS).

**Por que caminho absoluto pro binário do `tsx`, e não `npm start`:** é exatamente o
comando que validei com o Inspector acima (`./node_modules/.bin/tsx src/index.ts`) —
evita uma camada de processo a mais (`npm` spawnando `tsx` spawnando `node`) que um
cliente MCP não precisa, e evita depender de que o cliente resolva `npx`/`npm` no PATH
dele, que nem sempre é o mesmo PATH do terminal. Caminhos absolutos porque a maioria dos
clientes MCP spawna o processo com um `cwd` próprio, não necessariamente
`mcp-lab/` — um caminho relativo quebraria de forma silenciosa e difícil de depurar.

**Pré-requisito**: Postgres do `rag-lab` de pé (`docker compose up -d` dentro de
`rag-lab/`) antes de o cliente MCP conectar — o servidor sobe mesmo sem Postgres
acessível (só falha quando uma tool/resource tenta uma query), mas `buscar_chunks` e
`arquivos_indexados` não vão funcionar sem ele.

## As quatro primitivas, de ponta a ponta

| Primitiva | Nome | Quem decide invocar | Depende de | Validado por |
| --- | --- | --- | --- | --- |
| Tool | `buscar_chunks` | Modelo | Postgres (não Groq) | 12 unit + contract tests + Postgres real + Inspector `--cli` |
| Tool | `perguntar_corpus` | Modelo | Postgres + Groq | 6 unit + contract tests + Postgres real + Groq real (você) |
| Resource | `arquivos_indexados` | Aplicação (carrega como contexto) | Postgres | 2 unit + contract tests + Postgres real + Inspector `--cli` |
| Prompt | `nova_pergunta_avaliacao` | Usuário (aciona explicitamente) | Nada (zero I/O) | 3 unit + contract tests + Inspector `--cli` |

37 testes automatizados (`npm test`, sem rede/Postgres real), mais a validação manual
contra infraestrutura real registrada acima em cada bloco — a métrica de sucesso do PRD
("consegue explicar tool vs. resource vs. prompt citando qual primitiva o `mcp-lab` usou
pra cada capacidade e por quê") está coberta pela seção "O contraste entre as três
primitivas" em "Decisões", com um exemplo real de cada uma rodando contra dado real.

## Não-escopo (herdado do PRD)

Streamable HTTP, servidor remoto, OAuth 2.1, wrapper 1:1 da superfície do `rag-lab`
(sem tool de ingestão/reindexação — é escrita com efeito colateral, não exposta a um
modelo decidir sozinho), indexar corpus novo, publicar o servidor em registro público,
MCP de portfólio/currículo (fase 2 separada, com PRD e confirmação de segurança
próprios quando abrir).

## Riscos herdados do PRD, ainda válidos

- **Acoplamento com um projeto que ainda pode mudar**: `rag-lab` é "v1 completa", não
  congelada. O contract test via `InMemoryTransport` pega quebra na forma da resposta
  MCP; não pega quebra de schema do Postgres (isso é coberto pelos testes do próprio
  `rag-lab`).
- **Dado sai pela cadeia do cliente MCP**, não só pelo servidor — mesmo princípio já
  documentado no `rag-lab` para o Groq, aqui o destino é o provedor do cliente MCP que
  conectar. Não bloqueante nesta v1 (corpus sem dado sensível); vira bloqueante se este
  servidor apontar para o vault pessoal no futuro.
