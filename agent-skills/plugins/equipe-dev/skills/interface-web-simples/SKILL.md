---
name: interface-web-simples
description: UI/UX para interfaces HTML/CSS/JS sem framework — hierarquia visual, estados (vazio, carregando, erro, sucesso), feedback de ação, contraste e legibilidade, consistência de componentes, rotulagem legível por humano. Use ao desenhar ou revisar consoles internos e páginas de teste manual.
paths:
  - "public/**/*.html"
  - "public/**/*.css"
  - "public/**/*.js"
---

# Interface web simples: usabilidade sem framework

Ferramenta interna não precisa de identidade visual nem de design system — precisa que
quem testa não se perca. A prioridade abaixo é fixa: resolva na ordem, pare quando o
orçamento acabar.

## 1. Nunca uma tela em branco sem explicação

Todo estado tem texto, mesmo os que "nunca deveriam aparecer":

| Estado | Sem isso, quem testa pensa | Mínimo aceitável |
|---|---|---|
| Vazio (nada selecionado/criado ainda) | "quebrou" | "Selecione X à esquerda, ou clique em Y" |
| Carregando | "travou" | indicador de que algo está em andamento |
| Erro | "quebrou" ou tenta de novo sem saber por quê | o que falhou, em uma frase que não seja o stack trace |
| Sucesso silencioso (ação sem confirmação visível) | "clicou e não fez nada?" | algo muda na tela na hora, mesmo que discreto |

## 2. Toda ação tem retorno imediato

Botão clicado, formulário enviado, conexão aberta: algo muda na tela **antes** da
resposta do servidor chegar (estado `disabled`/`loading`) e **depois** que ela chega
(resultado ou erro). Sem isso, duplo clique e reenvio acidental são o sintoma mais comum.

## 3. Rótulo que humano lê, não ID técnico

UUID, timestamp cru, enum em inglês: nenhum diz nada para quem está testando. Troque por
data/hora formatada, título derivado do conteúdo (primeira mensagem, nome), ou label
traduzido — nessa ordem de preferência. Só use o ID cru como último recurso, e mesmo
assim truncado com indicação de que é um identificador (`#1dee261a`), não como se fosse
o nome da coisa.

## 4. Contraste mínimo AA

4.5:1 para texto normal, 3:1 para texto grande (≥18.66px bold ou ≥24px regular) e para
elementos de interface (bordas de campo, ícones informativos). Fórmula de luminância
relativa (WCAG) para checar um par de cores rapidamente:

```js
function luminance([r, g, b]) {
  const [R, G, B] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrastRatio(rgbA, rgbB) {
  const [L1, L2] = [luminance(rgbA), luminance(rgbB)].sort((a, b) => b - a);
  return (L1 + 0.05) / (L2 + 0.05);
}
```

Texto cinza sobre fundo claro é o erro mais comum (`#999` sobre `#fff` dá ~2.85:1 —
reprova). Prefira `#666` ou mais escuro para texto secundário sobre branco.

## 5. Consistência de componentes

Um único estilo de botão (cor de ação, hover, `:disabled`) reaproveitado em toda a
página — nunca um botão com CSS próprio ao lado de outros com a regra genérica. Mesma
lógica para bolhas de mensagem, cartões de lista e campos de formulário: se dois
elementos fazem a mesma coisa, usam a mesma classe.

## Processo de revisão

1. Veja a página renderizada (captura de tela, ou a skill `run` se disponível) antes de
   opinar sobre HTML/CSS lido a frio — flexbox e cor calculada erram feio quando só lidos.
2. Percorra as seções 1–5 nessa ordem; pare de listar achados de uma seção mais abaixo se
   a de cima já tem problema sério — corrigir hierarquia de novo depois de resolver "tela
   em branco" é retrabalho.
3. Não invente achado de gosto pessoal (cor "mais bonita", ícone "mais moderno") — isso
   não é usabilidade, é preferência, e fica de fora.
