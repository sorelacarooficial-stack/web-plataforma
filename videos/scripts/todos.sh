#!/usr/bin/env bash
# Prepara (y con --render, renderiza) todas las fichas, de dos en dos.
#   CRUDOS=/ruta/a/los/crudos bash scripts/todos.sh [--render]
set -euo pipefail
cd "$(dirname "$0")/.."
fichas=(fichas/*.json)
uno() {
  local f=$1 id
  id=$(basename "$f" .json)
  node scripts/preparar.mjs "$f"
  if [[ "${RENDER:-}" == 1 ]]; then
    node scripts/render.mjs "$id" --salida "../public/empieza-aqui/${id#ea-}.mp4"
  fi
}
[[ "${1:-}" == "--render" ]] && export RENDER=1
export -f uno
printf '%s\n' "${fichas[@]}" | xargs -P 2 -I{} bash -c 'uno {}'
