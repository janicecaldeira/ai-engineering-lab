#!/usr/bin/env bash
set -u
arquivo="$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("file_path",""))' 2>/dev/null || true)"
[ -n "$arquivo" ] || exit 0
[ -f "$arquivo" ] || exit 0
raiz="${CLAUDE_PROJECT_DIR:-$PWD}"

case "$arquivo" in
  *.ts|*.tsx|*.js|*.mjs|*.cjs)
    [ -x "$raiz/node_modules/.bin/prettier" ] && "$raiz/node_modules/.bin/prettier" --log-level silent --write "$arquivo" >/dev/null 2>&1
    if [ -x "$raiz/node_modules/.bin/eslint" ]; then
      saida="$("$raiz/node_modules/.bin/eslint" --fix --no-warn-ignored "$arquivo" 2>&1)" || {
        echo "eslint ainda reporta problemas em $arquivo:"; echo "$saida" | tail -15
      }
    fi
    comentarios="$(grep -nE '^\s*(//|/\*|\*\s|\*/)|[;,{})]\s+//\s' "$arquivo" | grep -vE '//\s*(eslint-|@ts-|/\s*<reference)|/\*\s*eslint' || true)"
    ;;
  *.sh|*.yml|*.yaml|*/Dockerfile|Dockerfile|*.dockerignore|*.env.example)
    comentarios="$(grep -nE '^\s*#([^!]|$)|\S\s+#\s' "$arquivo" | grep -vE '^[0-9]+:#\s*syntax=' || true)"
    ;;
  *) exit 0 ;;
esac

if [ -n "${comentarios:-}" ]; then
  echo "comentários em $arquivo — a equipe não escreve código comentado; o porquê vai no commit ou no ADR:"
  echo "$comentarios" | head -10
fi
exit 0
