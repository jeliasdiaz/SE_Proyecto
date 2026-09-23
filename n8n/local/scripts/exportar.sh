#!/usr/bin/env bash
# Exporta los flujos del n8n local a n8n/<nombre>.json y verifica que no lleven secretos.
# Reglas del equipo (n8n/README.md): nombre F<n>-<nombre>; las copias "[PRUEBA] ..." no se exportan.
#
#   scripts/exportar.sh                 # todos
#   scripts/exportar.sh F1-registro     # solo ese (por nombre del flujo)
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env; set +a

tmp=$(docker compose exec -T n8n mktemp -d)
docker compose exec -T n8n n8n export:workflow --all --separate --output="$tmp" >/dev/null 2>&1
exportados=()
for archivo in $(docker compose exec -T n8n sh -c "ls $tmp"); do
  # Solo la definición del flujo: fuera dueño (nombre y correo), fechas, versiones y datos fijados,
  # que dependen de la instancia o pueden traer datos de prueba.
  salida=$(docker compose exec -T n8n cat "$tmp/$archivo" | FILTRO="$*" python3 -c '
import sys, json, os, re, unicodedata
d = json.load(sys.stdin)
nombre = unicodedata.normalize("NFD", d["name"]).encode("ascii", "ignore").decode()
nombre = re.sub(r"[^A-Za-z0-9._]+", "-", nombre).strip("-")
filtro = os.environ["FILTRO"].split()
if d["name"].startswith("[PRUEBA]") or (filtro and nombre not in filtro):
    sys.exit(0)
limpio = {k: d[k] for k in ("id", "name", "description", "nodes", "connections", "settings", "tags") if k in d}
limpio.update(active=False, pinData={})
open(f"../{nombre}.json", "w").write(json.dumps(limpio, ensure_ascii=False, indent=2) + "\n")
print(f"../{nombre}.json")')
  [[ -n $salida ]] && { exportados+=("$salida"); echo "n8n/${salida#../}"; }
done
docker compose exec -T n8n rm -rf "$tmp"

[[ ${#exportados[@]} -gt 0 ]] || { echo "No se exportó ningún flujo." >&2; exit 1; }

# Las credenciales viajan solo como referencia (id y nombre); los valores nunca deben aparecer.
if grep -lF -e "$SUPABASE_SECRET_KEY" -e "$WEBHOOK_SECRET" -e "$N8N_ENCRYPTION_KEY" "${exportados[@]}" \
   || grep -lE 'sb_secret_[A-Za-z0-9_-]+|eyJhbGciOi' "${exportados[@]}"; then
  echo "ERROR: hay secretos en los archivos de arriba. No los subas a Git." >&2
  exit 1
fi
