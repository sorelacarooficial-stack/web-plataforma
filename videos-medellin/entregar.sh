#!/usr/bin/env bash
# Copia ligera de una pieza para la página de revisión (y, si es la landing, para /medellin).
# Uso: bash entregar.sh <pieza-formato>   p. ej. autoridad-9x16 · landing-16x9
set -e
cd "$(dirname "$0")"
p="$1"
src="out/$p.mp4"
[ -f "$src" ] || { echo "falta $src"; exit 1; }
if [[ $p == landing-* ]]; then
  ancho=$([ "$p" = landing-16x9 ] && echo 1280 || echo 720)
  ffmpeg -v error -y -i "$src" -vf scale=$ancho:-2 -c:v libx264 -crf 25 -preset slow -pix_fmt yuv420p -an -movflags +faststart ../public/medellin/$p.mp4
  ffmpeg -v error -y -ss 2.2 -i "$src" -frames:v 1 -vf scale=$ancho:-2 -q:v 4 ../public/medellin/$p.jpg
  ls -la ../public/medellin/$p.*
else
  ffmpeg -v error -y -i "$src" -vf scale=720:-2 -c:v libx264 -crf 27 -preset slow -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 128k ../public/revision/medellin/$p.mp4
  ffmpeg -v error -y -ss 2.5 -i "$src" -frames:v 1 -vf scale=720:-2 -q:v 3 ../public/revision/medellin/$p.jpg
  ls -la ../public/revision/medellin/$p.*
fi
