#!/usr/bin/env bash
# Revisión rápida de producción antes de la demo (ver docs/plan-qa-demo.md). Solo hace lecturas y
# un POST sin el encabezado secreto a cada webhook, que n8n debe rechazar con 403: no crea datos ni
# envía correos. Un 404 en un webhook significa que el flujo no está publicado (activo).
#
#   APP_URL=https://gestion-solicitudes-se.vercel.app \
#   SUPABASE_URL=https://<proyecto>.supabase.co SUPABASE_PUBLISHABLE_KEY=sb_publishable_... \
#   N8N_URL=https://<vm>.<region>.cloudapp.azure.com \
#   infra/verificar-demo.sh
set -uo pipefail
: "${APP_URL:?Falta APP_URL}" "${SUPABASE_URL:?Falta SUPABASE_URL}"
: "${SUPABASE_PUBLISHABLE_KEY:?Falta SUPABASE_PUBLISHABLE_KEY}" "${N8N_URL:?Falta N8N_URL}"

fallos=0
codigo() { curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$@"; }
revisar() { # descripción, código esperado, código obtenido
  if [[ $3 == "$2" ]]; then
    echo "  OK     $1"
  else
    echo "  FALLA  $1 (esperaba $2, fue $3)"
    fallos=$((fallos + 1))
  fi
}

echo "Web ($APP_URL)"
# 401 = protección de Vercel activa en esa URL; 404 = el dominio no apunta a un despliegue.
revisar "el login carga sin pedir cuenta de Vercel" 200 "$(codigo "$APP_URL/login")"
revisar "las rutas privadas redirigen al login" 307 "$(codigo "$APP_URL/gestion")"

echo "Supabase ($SUPABASE_URL)"
# Un proyecto gratuito pausado por inactividad no responde 200: hay que restaurarlo desde el panel.
revisar "Auth responde (proyecto activo, no pausado)" 200 \
  "$(codigo -H "apikey: $SUPABASE_PUBLISHABLE_KEY" "$SUPABASE_URL/auth/v1/health")"

echo "n8n ($N8N_URL)"
revisar "n8n en línea con HTTPS válido" 200 "$(codigo "$N8N_URL/healthz")"
for flujo in f1-registro f2-cambio-estado; do
  revisar "$flujo publicado y protegido por el encabezado secreto" 403 \
    "$(codigo -X POST -H 'Content-Type: application/json' -d '{}' "$N8N_URL/webhook/$flujo")"
done

echo
if [[ $fallos -eq 0 ]]; then
  echo "Todo en orden."
else
  echo "$fallos revisiones fallaron."
  exit 1
fi
