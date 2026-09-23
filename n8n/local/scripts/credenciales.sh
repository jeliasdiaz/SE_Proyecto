#!/usr/bin/env bash
# Crea (o actualiza) en el n8n local las credenciales que usan los flujos, a partir de n8n/.env.
# Los IDs son fijos para que los JSON exportados las encuentren al importarlos en otra máquina.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env; set +a

python3 - <<'PY' | docker compose exec -T n8n sh -c 'cat > /tmp/credenciales.json'
import json, os
e = os.environ
print(json.dumps([
    {"id": "seSupabaseLocal1", "name": "Supabase local", "type": "supabaseApi",
     "data": {"host": e["SUPABASE_URL"], "serviceRole": e["SUPABASE_SECRET_KEY"]}},
    {"id": "seSmtpLocal00001", "name": "SMTP local (Mailpit)", "type": "smtp",
     "data": {"user": "", "password": "", "host": e["SMTP_HOST"], "port": int(e["SMTP_PORT"]),
              "secure": False, "disableStartTls": True}},
    {"id": "seImapLocal00001", "name": "Buzón IMAP local (GreenMail)", "type": "imap",
     "data": {"user": e["BUZON_CORREO"], "password": e["BUZON_CLAVE"], "host": "greenmail",
              "port": 3143, "secure": False, "allowUnauthorizedCerts": True}},
    {"id": "seWebhookSecret1", "name": "Webhook Supabase (encabezado secreto)", "type": "httpHeaderAuth",
     "data": {"name": e["WEBHOOK_HEADER"], "value": e["WEBHOOK_SECRET"]}},
]))
PY

docker compose exec -T n8n sh -c 'n8n import:credentials --input=/tmp/credenciales.json; rm -f /tmp/credenciales.json'
