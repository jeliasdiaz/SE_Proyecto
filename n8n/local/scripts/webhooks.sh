#!/usr/bin/env bash
# Crea en el Supabase LOCAL los Database Webhooks (#25) que disparan F1 y F2: los mismos que en la
# nube se crean en Database → Webhooks del panel de Supabase (INSERT y UPDATE de `solicitudes`,
# POST con el encabezado secreto). `supabase db reset` los borra: vuelve a correr este script
# después de cada reset.
#
#   scripts/webhooks.sh
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env; set +a

cabeceras=$(printf '{"Content-Type": "application/json", "%s": "%s"}' "$WEBHOOK_HEADER" "$WEBHOOK_SECRET")

# El contenedor de la base está en la red de Supabase, igual que n8n: lo alcanza como http://n8n:5678.
docker exec -i supabase_db_SE_Proyecto psql -U postgres -q -v ON_ERROR_STOP=1 -v cabeceras="$cabeceras" <<'SQL'
create extension if not exists pg_net with schema extensions;

drop trigger if exists f1_registro on public.solicitudes;
create trigger f1_registro
after insert on public.solicitudes
for each row execute function supabase_functions.http_request(
  'http://n8n:5678/webhook/f1-registro', 'POST', :'cabeceras', '{}', '5000'
);

drop trigger if exists f2_cambio_estado on public.solicitudes;
create trigger f2_cambio_estado
after update on public.solicitudes
for each row execute function supabase_functions.http_request(
  'http://n8n:5678/webhook/f2-cambio-estado', 'POST', :'cabeceras', '{}', '5000'
);
SQL

echo "Webhooks f1_registro y f2_cambio_estado creados en el Supabase local."
