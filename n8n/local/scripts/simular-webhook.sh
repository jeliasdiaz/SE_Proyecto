#!/usr/bin/env bash
# Simula el Database Webhook de Supabase (#25) mientras no esté configurado.
#
#   scripts/simular-webhook.sh insert <ruta> [solicitud_id]
#   scripts/simular-webhook.sh update <ruta> <estado_anterior> [solicitud_id]
#
# Toma una solicitud real del Supabase local para que F1/F2 puedan consultar sus datos.
# Con PRUEBA=1 usa la URL de prueba (/webhook-test/, cuando el flujo está en "Listen for test event").
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env; set +a

operacion=${1:?insert o update}; ruta=${2:?ruta del webhook}
if [[ $operacion == update ]]; then anterior=${3:?estado anterior}; id=${4:-}; else anterior=; id=${3:-}; fi

api=http://127.0.0.1:54321/rest/v1
filtro=${id:+&id=eq.$id}
registro=$(curl -sf "$api/solicitudes?select=*&order=creada.desc&limit=1$filtro" \
  -H "apikey: $SUPABASE_SECRET_KEY" | python3 -c 'import sys,json;r=json.load(sys.stdin);print(json.dumps(r[0]) if r else "")')
[[ -n $registro ]] || { echo "No encontré la solicitud." >&2; exit 1; }

cuerpo=$(OP=$operacion ANT=$anterior REG=$registro python3 -c '
import json, os
r = json.loads(os.environ["REG"])
viejo = None
if os.environ["OP"] == "update":
    viejo = dict(r, estado=os.environ["ANT"])
print(json.dumps({"type": os.environ["OP"].upper(), "table": "solicitudes", "schema": "public",
                  "record": r, "old_record": viejo}))')

base=webhook; [[ ${PRUEBA:-} == 1 ]] && base=webhook-test
echo "POST http://127.0.0.1:5678/$base/$ruta"
curl -sS -w '\nHTTP %{http_code}\n' -X POST "http://127.0.0.1:5678/$base/$ruta" \
  -H 'Content-Type: application/json' -H "$WEBHOOK_HEADER: $WEBHOOK_SECRET" -d "$cuerpo"
