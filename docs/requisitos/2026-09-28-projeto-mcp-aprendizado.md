# Projeto de aprendizado: servidor MCP

## Nome

**`mcp-lab`** — pasta `ai-engineering-lab/mcp-lab/`. **Confirmado pela Janice em
2026-09-28.** Paralelo direto a `rag-lab`: nome curto, tema explícito (o protocolo MCP),
não amarra o projeto ao `rag-lab` mesmo usando o corpus dele como dado da v1 — mesmo
critério que já valeu pro `rag-lab` não se chamar `postgres-lab` apesar do Postgres ser
peça central. Também não amarra à direção A (portfólio) da fase 2 — ver abaixo.

## Decisão: as duas direções, em sequência

**Confirmado pela Janice em 2026-09-28**, respondendo a Pergunta aberta 1: não é B *em
vez de* A — é B primeiro, A depois, como fase 2 do mesmo projeto (`mcp-lab`) ou como
entrega separada, a decidir quando chegar lá. Esta entrega (v1) cobre só B (expor o
`rag-lab`). Quando a fase de portfólio/currículo for aberta, o Risco de dado pessoal
saindo pela cadeia do cliente MCP (já registrado abaixo) deixa de ser hipotético e vira
bloqueante de verdade — precisa da mesma confirmação explícita que valeu pro Groq no
`rag-lab`, feita naquele momento, não antecipada aqui.

## Problema

A Janice usa servidores MCP todo dia (Claude Code) mas nunca construiu um — o pedido
("gosto da ideia de fazer um MCP, pq usei vários já") é sintoma do mesmo padrão dos
outros dois projetos do lab: ela sabe *usar* a peça e quer parar de tratá-la como caixa
preta. Não é demanda de produto para terceiros nem serve diretamente à recolocação
(contexto real, mas objetivo declarado do lab é aprendizado — não forço isso a virar
métrica). O risco de um projeto de aprendizado sem recorte é o mesmo do `rag-lab`:
copiar um tutorial de servidor MCP "hello world" sem entender por que as três
primitivas (tool/resource/prompt) existem separadas, ou por que stdio e Streamable HTTP
não são intercambiáveis.

## Objetivo e métricas de sucesso

Objetivo: sair do projeto sabendo explicar e defender o desenho de um servidor MCP —
por que algo é tool e não resource, por que stdio e não HTTP nesta entrega, como o SDK
lida com erro de handler — com um servidor funcionando de ponta a ponta e validado por
um cliente real.

Métricas de sucesso (aprendizado, não produto — sinais de compreensão e evidência, não
usuário ativo, mesmo espírito do `rag-lab`):
- Consegue explicar, sem consultar nada, a diferença entre tool, resource e prompt
  citando qual primitiva o `mcp-lab` usou pra cada capacidade e por quê — evidência:
  README de decisões (`readme-decisoes`) com essa justificativa por capacidade.
- Testou o servidor com o **MCP Inspector** e documentou pelo menos uma sessão (log ou
  captura) no README — evidência: seção "Como testei" com o passo a passo reproduzível.
- Conectou o servidor a um cliente MCP real (Claude Code ou Claude Desktop) via stdio e
  confirma que uma tool foi chamada pelo modelo com sucesso — evidência: trecho de
  conversa ou log citado no README.
- Tem teste automatizado por handler (unit) e pelo menos um contract test via
  `InMemoryTransport` do SDK — evidência: `npm test` rodando, nomeado por comportamento.
- Zero dado sensível saindo sem confirmação explícita — regra de segurança já em vigor,
  não é métrica nova.

## Usuários e cenários

Único usuário: a própria Janice, em modo aprendizado, como cliente do próprio servidor.
Cenário de uso real (não só demo): ela abre o Claude Code, o `mcp-lab` está registrado
como servidor MCP local, ela faz uma pergunta sobre o corpus do `rag-lab` em linguagem
natural dentro da conversa, e o modelo decide chamar a tool certa sozinho — ela observa
a chamada acontecer (via Inspector ou log) para entender o protocolo por dentro.

## Escopo desta entrega

### Direção escolhida: expor o `rag-lab`, não um MCP de portfólio/currículo

O briefing trouxe duas direções. Recomendo **B — expor o `rag-lab` via MCP** em vez de
**A — MCP de portfólio/currículo**. Ver Premissa 1 para o porquê e Pergunta aberta 1
para a alternativa não escolhida.

### Histórias

- Como Janice aprendendo o protocolo MCP, quero uma tool que responda perguntas sobre o
  corpus do `rag-lab` reaproveitando o pipeline de retrieval+geração já validado, para
  ver um cliente MCP invocar uma tool "de verdade" (não um eco) e receber resultado
  estruturado.
  - Dado o servidor rodando via stdio e um cliente MCP conectado, quando o cliente chama
    a tool `perguntar_corpus` com uma pergunta, então a tool devolve resposta + lista de
    fontes (arquivo de origem), chamando as mesmas funções de `retrieval`/`geracao` que
    o `rag-lab` já usa em `npm run perguntar` — sem duplicar a lógica.
  - Dado uma pergunta fora do corpus, quando a tool é chamada, então devolve a mesma
    frase de recusa já definida no `rag-lab` ("não encontrei contexto suficiente para
    responder com confiança"), sem inventar.
  - Dado o Groq indisponível, com erro ou rate limit, quando a tool é chamada, então o
    erro volta estruturado como resultado de erro da tool (conforme o SDK) — não derruba
    o processo do servidor nem quebra outras chamadas.
  - Dado uma pergunta vazia ou só espaços, quando a tool é chamada, então devolve erro de
    validação claro antes de gastar embedding/chamada ao Groq.

- Como Janice, quero uma segunda tool de busca semântica pura (sem geração), para
  explorar o que foi indexado sem gastar uma chamada ao Groq e para comparar na prática
  "retrieval cru" vs. "resposta gerada" — as duas tools cobrem outcomes diferentes
  (debug/exploração vs. resposta final), não é wrapper duplicado da primeira.
  - Dado uma query e um limite opcional, quando a tool `buscar_chunks` é chamada, então
    devolve os N chunks mais próximos com arquivo de origem, posição e distância de
    cosseno — mesma busca de `src/retrieval/buscar.ts` do `rag-lab`.
  - Dado um limite fora da faixa aceita (zero, negativo, ou maior que o corpus), quando a
    tool é chamada, então devolve erro de validação, sem quebrar o servidor.

- Como Janice, quero um resource que liste os arquivos indexados no corpus, para
  experimentar na prática a diferença entre "dado que a aplicação carrega como contexto"
  (resource, application-controlled) e "ação que o modelo decide invocar" (tool).
  - Dado o servidor conectado, quando o cliente lista os resources disponíveis, então
    aparece um resource com a lista de arquivos indexados (nome do arquivo, contagem de
    chunks), lida do mesmo Postgres do `rag-lab`.

- Como Janice, quero um prompt MCP simples, para experimentar a terceira primitiva
  (acionada pelo usuário, não pelo modelo) e não só documentar a diferença, vivê-la.
  - Dado o cliente MCP, quando o usuário aciona o prompt `nova_pergunta_avaliacao`, então
    recebe um template pedindo pergunta + resposta esperada no formato usado por
    `src/avaliacao/dataset.json` do `rag-lab` — prepara insumo pra crescer o dataset de
    avaliação existente, sem duplicar a lógica de avaliação em si.

- Como Janice, quero testes automatizados por handler e validação manual com o MCP
  Inspector, para confiar que o servidor implementa o protocolo corretamente antes de
  conectar num cliente real.
  - Dado um tool handler exportado como função pura, quando rodo o teste unitário, então
    sucesso, borda (pergunta vazia, limite inválido) e erro (Groq indisponível, mockado)
    são verificados sem subir o servidor.
  - Dado o servidor completo, quando rodo um contract test via `InMemoryTransport` do
    SDK, então a forma da resposta (schema MCP: `tools/list`, `tools/call`,
    `resources/list`, `prompts/list`) é validada com uma requisição de protocolo real.
  - Dado o MCP Inspector conectado ao servidor via stdio, quando cada tool/resource/
    prompt é exercitado manualmente, então isso fica documentado no README como evidência
    (não é só "eu testei", é passo a passo reproduzível).

### Fora desta história, mas informando a decisão técnica (Dédalo decide, não eu)

- SDK oficial cru (`@modelcontextprotocol/sdk`) ou wrapper tipo FastMCP/mcp-framework —
  decisão pedagógica, mesmo critério do `rag-lab` sobre framework: o briefing pede
  explicitamente que essa decisão não seja minha.
- Estrutura do pacote: `mcp-lab/` como projeto Node independente que só aponta para o
  mesmo Postgres do `rag-lab` via `DATABASE_URL` compartilhada, vs. importar módulos do
  `rag-lab` por caminho relativo (`../rag-lab/src/retrieval`) dentro do mesmo repo. Afeta
  a Pergunta aberta 4.
- Formato exato do schema de input/output de cada tool (Zod, JSON Schema manual, etc.).

## Não-escopo

- **Streamable HTTP / servidor remoto, OAuth 2.1** — v1 é stdio, local, single-user,
  mesma máquina. A camada de auth remota e o transporte HTTP são aprendizado real de MCP
  em produção, mas são um projeto (ou uma fase 2) à parte — misturar os dois nesta
  entrega dilui o foco nas três primitivas, que é o que a métrica de sucesso cobra.
- **Wrapper 1:1 da superfície do `rag-lab`** — não expor ingestão/reindexação como tool.
  É ação de escrita com efeito colateral (apaga e reinsere linhas no Postgres); expor
  isso pra um modelo decidir chamar sem confirmação humana contraria o "outcome-first" e
  o guardrail determinístico que a própria pesquisa cita como padrão de produção.
- **Indexar corpus novo** — v1 reusa o corpus e o Postgres já existentes e validados do
  `rag-lab` (133 chunks, HNSW, 55% de acerto documentado). Não cria pipeline de ingestão
  paralelo nem outro corpus.
- **Publicar o servidor** (registro público de MCP, Glama, marketplace) — é aprendizado
  local, não distribuição; fica pra uma decisão futura e explícita, se fizer sentido.
- **MCP de portfólio/currículo (direção A do briefing)** — não descartado, confirmado
  como fase 2 (ver "Decisão" no topo do documento), só não é esta entrega. Quando essa
  fase abrir, precisa de PRD próprio (dado pessoal muda a análise de risco) e da mesma
  confirmação explícita de segurança que o Groq exigiu no `rag-lab`.

## Premissas assumidas

1. **Direção B (expor o `rag-lab`) em vez de A (portfólio/currículo).** Dois motivos:
   (a) reaproveita infraestrutura já validada — Postgres+pgvector+embedding local, taxa
   de acerto medida — então o esforço novo desta entrega é só a casca de protocolo, não
   dado nem pipeline; (b) o corpus do `rag-lab` foi escolhido no PRD anterior
   *explicitamente* por não ter dado sensível e não acionar a regra de segurança — B
   mantém esse padrão, A rompe com ele (currículo é dado pessoal). Isso é premissa
   minha, não confirmação da Janice — ver Pergunta aberta 1 se ela preferir A ou um
   projeto que cubra as duas direções em sequência.
2. **V1 cobre as três primitivas (2 tools + 1 resource + 1 prompt), não só "2-4 tools".**
   O briefing sugeriu 2-4 tools; ajustei porque a métrica de sucesso pede explicitamente
   que ela saiba explicar tool vs. resource vs. prompt, o que exige ao menos um exemplo
   de cada — só tools não ensina o contraste. Questionável: se o tempo apertar, o prompt
   é o primeiro item a cortar (menor valor pedagógico das três; tool e resource já
   ilustram o contraste principal — "modelo decide" vs. "aplicação carrega").
3. **Transporte stdio, sem servidor remoto nem OAuth** — consistente com o resto do lab
   (tudo roda local) e com a sugestão do briefing.
4. **O servidor lê do mesmo Postgres do `rag-lab`** (mesma `DATABASE_URL`), não duplica
   dado nem reindexação — trata o `rag-lab` como serviço existente e só adiciona uma
   casca de protocolo MCP em cima, na linha de "fonte única evita duplicação" que já é
   padrão dela no resto do lab.
5. **Framework do SDK fica pro Dédalo** — conforme o briefing pediu explicitamente.

## Perguntas abertas

1. ~~Confirma a direção B em vez de A?~~ **Respondida em 2026-09-28: as duas, em
   sequência** — ver "Decisão" acima. Esta entrega é só B.
2. O `rag-lab` tem taxa de acerto de 55% (11/20) documentada, com gargalo conhecido em
   retrieval. O `mcp-lab` herda essa limitação tal como está — a tool `perguntar_corpus`
   vai recusar ou errar nos mesmos casos que o `rag-lab` já erra. Tudo bem expor "como
   está", sem melhorar o retrieval antes (o objetivo aqui é o protocolo, não RAG), ou
   isso merece o ajuste do `rag-lab` (limite de chunks 5→8-10) como pré-requisito?
   Assumo que não é pré-requisito — documentar a limitação basta. **Ainda em aberto.**
3. ~~Confirma o nome `mcp-lab`?~~ **Respondida em 2026-09-28: confirmado.**
4. Estrutura de dependência entre `mcp-lab` e `rag-lab`: pacote separado só apontando
   pro mesmo Postgres, ou importar módulos do `rag-lab` por caminho relativo dentro do
   mesmo repo? Decisão do Dédalo, mas registro aqui porque muda o Risco de acoplamento
   abaixo — se ele preferir desacoplar totalmente (copiar as funções em vez de
   importar), o `mcp-lab` para de quebrar quando o `rag-lab` mudar, ao custo de duas
   cópias da lógica de retrieval. **Ainda em aberto, do Dédalo.**

## Riscos e dependências

- **Depende do `rag-lab` estar de pé**: precisa do Postgres com pgvector rodando
  (`docker compose up -d` do `rag-lab`) e do `GROQ_API_KEY` configurado pra
  `perguntar_corpus` funcionar de ponta a ponta. Sem isso, só dá pra validar
  `buscar_chunks` (não depende do Groq) e os testes unitários com mock.
- **Dado sai pela cadeia do cliente MCP, não só pelo servidor.** Mesmo com corpus sem
  dado sensível e transporte stdio local, qualquer conteúdo que uma tool devolver passa
  pelo modelo do lado do cliente MCP (Claude Code/Desktop) antes de virar resposta —
  mesmo princípio que o `rag-lab` já documentou para o Groq, só que aqui o destino é o
  provedor do cliente que ela conectar. Não é bloqueante para esta v1 (corpus sem dado
  sensível, decisão já tomada no PRD do `rag-lab`), mas **vira bloqueante se este
  servidor for reaproveitado pra apontar pro vault pessoal (`SegundoCerebro`) no
  futuro** — mesma régua de confirmação explícita já registrada no PRD do `rag-lab`, e
  reforçada se a direção A (currículo, dado pessoal) for escolhida na Pergunta aberta 1.
- **Acoplamento com um projeto que ainda pode mudar**: o `rag-lab` é "v1 completa" mas
  não congelada — mudança no schema do Postgres, no nome dos módulos de
  `retrieval`/`geracao`, ou no modelo do Groq quebra o `mcp-lab` junto. Mitigação: o
  contract test via `InMemoryTransport` pega quebra na forma da resposta MCP; não pega
  quebra de schema do Postgres (isso é coberto pelos próprios testes do `rag-lab`).
- **SDK e spec relativamente novos**: a spec 2026-07-28 e o SDK TS v2 são recentes —
  exemplo de blog ou tutorial de terceiro pode ainda referenciar a spec anterior
  (HTTP+SSE em vez de Streamable HTTP). Conferir a doc oficial
  (`ts.sdk.modelcontextprotocol.io`) antes de seguir exemplo desatualizado.

## Fontes consultadas

Research prévio fornecido por quem acionou este PRD (>=15 fontes levantadas); linkadas
abaixo as que vieram com URL:

1. [SDK oficial TypeScript v2 — documentação](https://ts.sdk.modelcontextprotocol.io/v2/)
2. [SDK oficial TypeScript — repositório](https://github.com/modelcontextprotocol/typescript-sdk)
3. [WorkOS — MCP features guide (tools/resources/prompts)](https://workos.com/blog/mcp-features-guide)
4. [AWS Labs — MCP design guidelines](https://github.com/awslabs/mcp/blob/main/DESIGN_GUIDELINES.md)
5. [Itential — Designing MCP servers for infrastructure](https://www.itential.com/resource/blog/designing-mcp-servers-for-infrastructure/)
6. [TrueFoundry — MCP stdio vs. Streamable HTTP para enterprise](https://www.truefoundry.com/blog/mcp-stdio-vs-streamable-http-enterprise)
7. [MCP — Security best practices (spec 2026-07-28)](https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices)
8. [dev.to — How to test MCP servers in TypeScript before they break in production](https://dev.to/mudassirworks/how-to-test-mcp-servers-in-typescript-before-they-break-in-production-5d60)
9. [Scalar — Test MCP servers](https://scalar.com/learn/mcp/test-mcp-servers)
10. [MCP Inspector — documentação oficial](https://modelcontextprotocol.io/docs/2026-07-28/tools/inspector)
11. [ProjectPro — MCP projects (portfólio/carreira como padrão de projeto)](https://www.projectpro.io/article/mcp-projects/1142)
