# ai-engineering-lab
Laboratório de engenharia de IA: integrações com LLMs, RAG e agentes construídos com TypeScript e Node.js

## Projetos

- [`agent-skills/`](agent-skills/) — marketplace local do Claude Code: personas (agents) e
  skills da equipe-dev (arquitetura, produto, testes, dados, infra, documentação, UI/UX).
- [`rag-lab/`](rag-lab/) — RAG (Retrieval-Augmented Generation) construído do zero em
  TypeScript, stack 100% gratuita (embedding local, Postgres/pgvector, geração via Groq
  free tier). Projeto de aprendizado: pipeline completo de ingestão a avaliação, com as
  decisões de arquitetura e os números da avaliação documentados no README do projeto.
- [`mcp-lab/`](mcp-lab/) — servidor MCP (Model Context Protocol) construído do zero em
  TypeScript, expondo o `rag-lab` como tools/resource/prompt via stdio. Projeto de
  aprendizado do protocolo: uma primitiva de cada tipo, validada com o MCP Inspector
  contra o transporte real, com as decisões documentadas no README do projeto.
