#!/usr/bin/env bash
# Importa al n8n local los flujos exportados en n8n/*.json (sobrescribe los que tengan el mismo id),
# los publica y reinicia n8n: importar despublica, y publicar por CLI requiere reiniciar.
#
#   scripts/importar.sh                 # todos
#   scripts/importar.sh F1-registro     # solo ese
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ $# -gt 0 ]]; then archivos=("${@/#/../}"); archivos=("${archivos[@]/%/.json}"); else archivos=(../*.json); fi

for archivo in "${archivos[@]}"; do
  id=$(python3 -c 'import sys,json;print(json.load(open(sys.argv[1]))["id"])' "$archivo")
  docker compose exec -T n8n sh -c 'cat > /tmp/flujo.json' < "$archivo"
  docker compose exec -T n8n sh -c 'n8n import:workflow --input=/tmp/flujo.json && rm -f /tmp/flujo.json' 2>/dev/null \
    | grep -i 'imported' || true
  docker compose exec -T n8n n8n publish:workflow --id="$id" 2>/dev/null | grep '^Publishing' || true
done

docker compose restart n8n >/dev/null
until curl -sf http://127.0.0.1:5678/healthz/readiness >/dev/null; do sleep 2; done
echo "n8n listo con los flujos publicados."
