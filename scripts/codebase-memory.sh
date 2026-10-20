#!/usr/bin/env bash
# Instala codebase-memory-mcp (el grafo del código que usa Claude Code) si no
# está, y deja indexado este repositorio. Lo lanza el SessionStart de
# .claude/settings.json: las sesiones en la nube arrancan con un contenedor
# limpio, así que hay que traerlo cada vez. Si algo falla, no frena la sesión.
set -u
BIN="$HOME/.local/bin/codebase-memory-mcp"
REPO="$(cd "$(dirname "$0")/.." && pwd)"

if [ ! -x "$BIN" ]; then
  mkdir -p "$HOME/.local/bin" && tmp="$(mktemp -d)" || exit 0
  curl -fsSL -o "$tmp/c.tgz" \
    https://github.com/DeusData/codebase-memory-mcp/releases/latest/download/codebase-memory-mcp-linux-amd64.tar.gz \
    && tar xzf "$tmp/c.tgz" -C "$tmp" \
    && install -m755 "$tmp/codebase-memory-mcp" "$BIN" || { rm -rf "$tmp"; exit 0; }
  rm -rf "$tmp"
  "$BIN" config set auto_index true >/dev/null 2>&1
fi

# En segundo plano: indexar tarda unos segundos y la sesión no tiene que esperar.
( "$BIN" cli --quiet index_repository --repo-path "$REPO" >/dev/null 2>&1 & ) || true
exit 0
