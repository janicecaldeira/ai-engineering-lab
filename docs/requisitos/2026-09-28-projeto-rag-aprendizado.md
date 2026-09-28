# Projeto de aprendizado: RAG gratuito

## Nome

**`rag-lab`** — pasta `ai-engineering-lab/rag-lab/`. Decidido em 2026-09-28: nome neutro,
não compromete o projeto com nenhum corpus específico (ver Pergunta aberta 2 sobre o vault
pessoal como alvo futuro).

## Problema

A Janice viu um post no LinkedIn sobre montar RAG de forma gratuita e quer aprender RAG
**na prática**: não é uma demanda de produto para terceiros, é aprendizado dela mesma,
dentro do `ai-engineering-lab` (TypeScript/Node.js). O risco de um projeto de aprendizado
sem esse recorte é replicar tutorial de blog sem entender as decisões — ela quer o
contrário: entender trade-off, não só ver o app rodando.

## Objetivo e métricas de sucesso

Objetivo: sair do projeto sabendo explicar e defender cada peça do pipeline RAG
(chunking, embedding, indexação, retrieval, geração, avaliação), com um sistema
funcionando de ponta a ponta usando só ferramentas gratuitas (tier grátis ou local, zero
custo de infraestrutura paga).

Métricas de sucesso (é aprendizado, não produto — sinais são de compreensão e evidência,
não de usuário ativo):
- Consegue responder, sem consultar nada, "por que esse chunk size", "por que essa busca
  (vetorial pura ou híbrida)", "como eu sei que a resposta não é alucinação" — evidência:
  README com decisões e trade-offs (`readme-decisoes`, Hermes já cobre o formato).
- Tem um dataset de avaliação mínimo (10-20 perguntas com resposta esperada) e um número:
  quantas o sistema acerta. Não precisa ser RAGAS formal na v1; precisa ser mensurável.
- Zero real gasto: rodou do início ao fim com plano gratuito ou modelo local.

## Usuários e cenários

Único usuário: a própria Janice, em modo aprendizado. Cenário de uso real (não só
demo): perguntar algo sobre um corpus que ela escolhe (ver Escopo) e receber resposta
com a fonte citada, para poder conferir se está certo.

## Escopo desta entrega

### Histórias

- Como Janice aprendendo RAG, quero indexar um corpus de texto pequeno e real em chunks
  com metadata (fonte, posição) para depois recuperar o trecho certo.
  - Dado um diretório de arquivos `.md` ou `.pdf`, quando eu rodar o script de ingestão,
    então cada chunk fica salvo com texto + embedding + referência ao arquivo de origem.
  - Dado um arquivo vazio ou ilegível na pasta, quando a ingestão rodar, então ele é
    reportado e pulado, sem derrubar o processo inteiro.

- Como Janice, quero perguntar algo em linguagem natural e receber uma resposta com a(s)
  fonte(s) citada(s), para poder verificar se a resposta é confiável.
  - Dado uma pergunta sobre o corpus indexado, quando eu rodar a consulta, então recebo
    resposta + lista dos chunks/arquivos usados como contexto.
  - Dado uma pergunta fora do corpus (não tem resposta nos dados), quando eu rodar a
    consulta, então o sistema diz que não encontrou contexto suficiente — nunca inventa.

- Como Janice, quero um jeito de medir se a resposta está certa, para saber se mudar o
  chunk size ou a busca melhorou ou piorou o sistema.
  - Dado um conjunto de 10-20 perguntas com resposta esperada, quando eu rodar a
    avaliação, então recebo taxa de acerto (mesmo que julgada manualmente ou por LLM).

- Como Janice, quero documentar as decisões técnicas (chunking, embedding, vector store,
  modelo de geração) com o porquê de cada escolha, para o projeto valer como portfólio.
  - Dado o sistema funcionando, quando eu terminar a v1, então existe um README que
    explica arquitetura, decisões, trade-offs e "o que eu faria diferente".

### Fora desta história, mas informando a decisão técnica (Dédalo decide, não eu)

- Vector store: `pgvector` local (Docker) ou Chroma — os dois são gratuitos e locais.
- Embeddings: `sentence-transformers` local (zero custo, zero dado saindo da máquina) ou
  Gemini/Jina free tier (mais simples de montar, mas envia texto pra API externa).
- Geração: Groq ou Google AI Studio (Gemini) free tier, ou Ollama local.
- Com ou sem framework (LangChain.js / LlamaIndex.TS) vs. montado na mão — decisão
  pedagógica: framework é mais rápido, na mão ensina mais o mecanismo interno.

## Não-escopo

- GraphRAG, RAG agêntico, contextual retrieval (Anthropic), reranking com modelo pago —
  são otimizações de produção avançadas, não o ponto de partida de quem está aprendendo
  o fundamento. Podem virar v2 depois que o pipeline básico estiver dominado.
- Interface web — v1 é CLI/script; UI fica pra depois, se o projeto virar algo pra mostrar.
- Multi-usuário, controle de acesso por documento, deploy em produção.
- Apontar para o vault pessoal (`SegundoCerebro`) nesta entrega — ver Risco abaixo.

## Premissas assumidas

- **Corpus da v1 decidido em 2026-09-28**: os `SKILL.md`/`agents/*.md` do
  `agent-skills/` (~30 arquivos markdown já estruturados, zero risco de privacidade,
  já está no repo — dá pra começar a implementar sem esperar nada externo).
- Assumo que "gratuito" inclui tanto tier grátis de API externa (Groq, Gemini) quanto
  modelo local (Ollama, sentence-transformers) — ela decide o mix quando Dédalo desenhar.
- Assumo TypeScript (consistente com o resto do `ai-engineering-lab`), não Python, mesmo
  a maioria dos tutoriais de RAG sendo em Python — LangChain.js e LlamaIndex.TS cobrem
  o caminho oficial nesse stack.

## Perguntas abertas

1. **Vault pessoal como corpus (fase 2, opcional)**: se ela quiser eventualmente apontar
   o `rag-lab` pro `SegundoCerebro`, a regra de segurança do CLAUDE.md dela ("antes de
   mandar dado pra serviço externo, confirme comigo") exige stack 100% local nesse
   momento — sentence-transformers + Ollama + pgvector/Chroma local, sem Groq/Gemini.
   Ela topa esse recorte quando chegar lá, ou prefere manter o vault fora do RAG mesmo
   depois?
2. Com framework (LangChain.js/LlamaIndex.TS) ou "na mão" — decisão pedagógica, quem
   escolhe é ela; Dédalo pode listar o trade-off concreto de cada caminho quando desenhar.

## Riscos e dependências

- **Privacidade**: se o corpus escolhido tiver qualquer dado sensível (processos
  seletivos, notas pessoais) e a arquitetura usar embeddings ou geração via API externa
  (Groq, Gemini, Jina), esse texto sai da máquina dela. Isso exige confirmação explícita
  antes de implementar — é regra de segurança já estabelecida, não detalhe técnico.
  Mitigação da v1: corpus não-sensível por padrão (ver Premissas).
- **Custo "grátis" tem limite**: tiers grátis (Groq 6000 tokens/min, Gemini free) têm
  rate limit; corpus pequeno de aprendizado não deve esbarrar nisso, mas vale checar o
  limite atual do provedor escolhido antes de rodar a avaliação em lote.
- **Qualidade sem avaliação é ilusão**: sem o dataset de 10-20 perguntas (história 3), não
  dá pra saber se uma mudança no chunk size ajudou ou atrapalhou — é dependência dura das
  outras histórias, não opcional.
- Depende de decisão de arquitetura do Dédalo antes de começar a implementar (vector
  store, embeddings, framework ou não).

## Fontes consultadas (18)

**Conceito e arquitetura**
1. [IBM — What is RAG](https://www.ibm.com/think/topics/retrieval-augmented-generation)
2. [Wikipedia — Retrieval-augmented generation](https://en.wikipedia.org/wiki/Retrieval-augmented_generation)
3. [PremAI — Building Production RAG: Architecture, Chunking, Evaluation & Monitoring (2026 Guide)](https://www.premai.io/blog/building-production-rag-architecture-chunking-evaluation-monitoring-2026-guide/)
4. [Turing Post — 20 Advanced RAG Types to Know in 2026](https://www.turingpost.com/p/ragtypes)

**Chunking**
5. [Redis — Best Chunking Strategies for RAG Pipelines](https://redis.io/blog/chunking-strategy-rag-pipelines/)
6. [Weaviate — Chunking Strategies to Improve LLM RAG Pipeline Performance](https://weaviate.io/blog/chunking-strategies-for-rag)
7. [Unstructured — Chunking Strategies for RAG: Best Practices and Key Methods](https://unstructured.io/blog/chunking-for-rag-best-practices)

**Vector store e embeddings gratuitos**
8. [Redis — Comparing the best open source vector databases (2026)](https://redis.io/blog/best-open-source-vector-databases-comparison/)
9. Comparativo de embeddings locais gratuitos (sentence-transformers vs. OpenAI) — busca "free embeddings API alternatives OpenAI local sentence-transformers"

**LLM gratuito**
10. [OpenRouter — Free LLM API in 2026: 13 Options Ranked and Compared](https://openrouter.ai/blog/tutorials/free-llm-apis-compared/)

**Retrieval, contexto e reranking**
11. [Towards Data Science — Hybrid Search and Re-Ranking in Production RAG](https://towardsdatascience.com/hybrid-search-and-re-ranking-in-production-rag/)
12. [Anthropic — Contextual Retrieval](https://www.anthropic.com/engineering/contextual-retrieval)

**Avaliação**
13. [Ragas — Metrics disponíveis](https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/)

**Erros comuns**
14. [Towards Data Science — 10 Common RAG Mistakes We Keep Seeing in Production](https://towardsdatascience.com/10-common-rag-mistakes-we-keep-seeing-in-production/)

**Stack TypeScript/Node**
15. [LlamaIndex.TS — Retrieval Augmented Generation (starter tutorial oficial)](https://ts.llamaindex.ai/docs/llamaindex/getting_started/starter_tutorial/retrieval_augmented_generation)
16. [LlamaIndex.TS — Developer Documentation](https://developers.llamaindex.ai/typescript/framework/)
17. [LangChain TS — Build RAG with LangChain TypeScript](https://langchain-ts.dev/rag/)

**Ideias de projeto de aprendizado**
18. [KDnuggets — 5 Fun RAG Projects for Absolute Beginners](https://www.kdnuggets.com/5-fun-rag-projects-for-absolute-beginners)
