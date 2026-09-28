# agent-skills

Fonte única das personas (subagents) e skills que a Janice usa nos projetos de
`~/Documents/Projetos`. É um **marketplace local do Claude Code** (nome
`janice-agent-skills` — `agent-skills` é reservado pela Anthropic) com um plugin,
`equipe-dev`, carregado *in place*: editar um arquivo aqui vale na próxima sessão (ou
após `/reload-plugins`), sem reinstalar.

## A equipe

| Persona | Nome na mitologia | Papel | Modelo | Ferramentas |
|---|---|---|---|---|
| `@equipe-dev:dedalo` | Dédalo, o arquiteto do Labirinto | eng. sênior/arquiteto Node/TS/NestJS; desenha e implementa | inherit | todas |
| `@equipe-dev:atena` | Atena, estratégia e sabedoria | produto e requisitos; matriz de rastreabilidade | sonnet | lê, escreve docs, pesquisa |
| `@equipe-dev:argos` | Argos Panoptes, cem olhos | testes, qualidade e revisão de correção | inherit | lê, roda, escreve testes |
| `@equipe-dev:mnemosine` | Mnemósine, a memória | dados: Postgres, migrations, ordenação, busca | inherit | lê, roda, escreve migrations |
| `@equipe-dev:hefesto` | Hefesto, a forja | infra: Docker, compose, CI, health, shutdown, observabilidade | inherit | todas |
| `@equipe-dev:hermes` | Hermes, o mensageiro | documentação: README, ADR, diagramas, explicação ao vivo | sonnet | lê, roda git, escreve docs |
| `@equipe-dev:iris` | Íris, o arco-íris | UI/UX de interfaces simples: consoles internos, páginas de teste manual | sonnet | lê, roda, escreve HTML/CSS/JS |

`inherit` = usa o modelo da sessão (troque no frontmatter se quiser fixar `opus`/`sonnet`).
Dédalo, Argos, Mnemósine, Hefesto e Íris têm `memory: project`: aprendem os padrões de
cada repositório entre sessões.

Convenção fixa de toda a equipe: **código sem comentários**. Nome, tipo e estrutura dizem
o que o código faz; o porquê vai na mensagem de commit e no ADR. Só diretivas de
ferramenta ficam (`eslint-disable`, `@ts-expect-error`, shebang, `# syntax=`). A regra
está nas personas, no `/equipe-dev:commit` (bloqueia), no `/equipe-dev:revisao` (é achado)
e no hook `PostToolUse`, que avisa ao editar um arquivo que ficou com comentário.

## Skills

Referência (carregam sozinhas quando o assunto ou o arquivo bate):

| Skill | Carrega ao tocar | Cobre |
|---|---|---|
| `nestjs-arquitetura` | `*.module.ts`, `*.controller.ts`, `*.service.ts` | módulos, DI, DTOs, erros, config; aponta para as demais |
| `redis-filas-tempo-real` | `*.processor.ts`, `*.gateway.ts`, `*queue*` | BullMQ, retry/DLQ, pub/sub, SSE vs WS, retomada, rate limit, cache; `reference/turno-do-agente.md` |
| `postgres-modelagem` | `migrations/`, `*.entity.ts`, `schema.prisma` | ordenação por `seq`, keyset, `ON CONFLICT`, FTS, índices, seed |
| `seguranca-api` | `*.guard.ts`, `*auth*`, `*webhook*` | JWT, escopo por usuário, HMAC/replay, segredos, SSE auth |
| `infra-docker-ci` | `Dockerfile*`, `compose*.yml`, `.github/workflows` | multi-stage não-root, compose com healthchecks, entrypoint, CI, shutdown, Terminus, pino, Prometheus, OTel |
| `testes-integracao` | `test/`, `*.spec.ts`, `*.e2e-spec.ts` | Testcontainers, app factory, concorrência, worker, SSE/WS, duas réplicas |
| `readme-decisoes` | — | esqueleto de README que justifica, ADR, Mermaid, perguntas e respostas |
| `interface-web-simples` | `public/**/*.html`, `*.css`, `*.js` | hierarquia, estados vazio/erro/carregando, contraste (fórmula WCAG), consistência de componentes |

Workflows (só você invoca; custo zero de contexto até chamar):

| Comando | O que faz |
|---|---|
| `/equipe-dev:plano-de-entrega <enunciado>` | matriz de requisitos + decisões críticas com default + plano por blocos com commits |
| `/equipe-dev:feature <bloco>` | ciclo completo com paradas: Atena → Dédalo (+Mnemósine/Hefesto) → implementação → Argos → revisão → Hermes |
| `/equipe-dev:requisitos <tema>` | PRD enxuto com perguntas abertas |
| `/equipe-dev:plano-de-testes <alvo>` | lacunas por comportamento, testes escritos e rodados |
| `/equipe-dev:revisao <escopo>` | personas em paralelo, contexto limpo, só confiança ≥ 80 |
| `/equipe-dev:commit` | commit incremental com mensagem que explica o porquê; nunca push |
| `/equipe-dev:checklist-entrega` | go/no-go com evidência: compose limpo, testes, lint, README, segredos, commits |

Hook incluído: após cada edição de `.ts/.js`, roda `prettier --write` e `eslint --fix`
**se** o projeto tiver as ferramentas em `node_modules/.bin`; nunca bloqueia, só avisa
quando o eslint ainda reporta erro.

## Ativar num projeto

```bash
cd ~/Documents/Projetos/meu-projeto
~/Documents/Projetos/agent-skills/bin/ativar               # escopo local (.claude/settings.local.json, fora do git)
~/Documents/Projetos/agent-skills/bin/ativar --completo    # + typescript-lsp e security-guidance (oficiais)
~/Documents/Projetos/agent-skills/bin/ativar --project     # escopo project (.claude/settings.json, versionado)
```

`--completo` é o recomendado para projetos TypeScript: `typescript-lsp` mostra erros de
tipo a cada edição (exige `typescript-language-server` no PATH — já instalado via npm
global) e `security-guidance` revisa segurança em cada edição e no fim do turno.

Vale para o CLI e para a extensão do VS Code (mesma configuração). Reinicie a sessão ou
rode `/reload-plugins`.

Por que por projeto e não global: agents e skills em `Projetos/.claude/` **não** são
vistos de dentro de um subprojeto que é repositório git (a busca para na raiz do repo), e um
plugin em `~/.claude/skills/` aparece em qualquer pasta da máquina. Testado em 2026-09-18.
Se quiser global mesmo: `ln -s ~/Documents/Projetos/agent-skills/plugins/equipe-dev ~/.claude/skills/equipe-dev`.

## Usar

- `@equipe-dev:dedalo desenhe o módulo de conversas` — delegação explícita
- Claude também delega sozinho pela `description` de cada persona
- `/equipe-dev:plano-de-entrega docs/enunciado.pdf` — começa um desafio pelo mapa
- `claude --agent equipe-dev:dedalo` — sessão inteira com a persona no thread principal

## Manter

- Descrição = gatilho da delegação: nome da persona + terceira pessoa + o que faz +
  quando usar, com as palavras que um pedido conteria. Somadas, bem abaixo de 15k tokens.
- Corpo da persona: processo em fases, formato de saída, critério do que reportar; até
  ~120 linhas. Conhecimento denso vai para skill.
- `SKILL.md` abaixo de 500 linhas; material extenso em `reference/` com sumário e link
  direto do SKILL.md (um nível só).
- Depois de editar: `bin/validar`. Plugin agents não suportam `hooks`, `mcpServers` nem
  `permissionMode` no frontmatter; plugin hooks vão em `hooks/hooks.json`.
- Para testar sem ativar em projeto: `claude --plugin-dir ~/Documents/Projetos/agent-skills/plugins/equipe-dev`.

## Adicionar uma persona ou skill

1. `plugins/equipe-dev/agents/<nome>.md` com `name`, `description`, `model`, `tools`
   (menor privilégio), opcionalmente `memory: project` e `color`.
2. `plugins/equipe-dev/skills/<nome>/SKILL.md`; workflows com efeito colateral usam
   `disable-model-invocation: true`; referência que deve carregar ao tocar arquivos usa
   `paths:`.
3. `bin/validar`, depois `/reload-plugins` numa sessão de um projeto ativado.
