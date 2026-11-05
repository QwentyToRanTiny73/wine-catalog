#!/usr/bin/env bash
# Собирает dist/ из белого списка файлов сайта.
# Временная замена `npm run build` до фазы 3 (Vite).
#
# Зачем: на GitHub Pages выкладывается только dist/, поэтому служебные файлы
# (docs/, CLAUDE.md, scripts/, исходные данные) на сайт не попадают.
# Новый файл сайта нужно явно добавить в список FILES — иначе его не будет на проде.
set -euo pipefail
cd "$(dirname "$0")/.."

FILES=(
  index.html
  style.css
  baza/index.html
  arkhiv/index.html
  js/data.js
  js/baza.js
  data/table.js
  data/table.css
)

rm -rf dist
for f in "${FILES[@]}"; do
  mkdir -p "dist/$(dirname "$f")"
  cp "$f" "dist/$f"
done

echo "dist/ собран: ${#FILES[@]} файлов"
